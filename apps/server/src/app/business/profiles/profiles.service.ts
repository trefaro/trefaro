import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  MAX_ACTIVITY_AREAS_LENGTH,
  PROFILE_CONFIRMATION_PATH,
  PROFILE_LOGIN_PATH,
  type ParticipantPasswordChange,
  type ParticipantProfileUpdate,
  type ProfileConfirmation,
  type ProfileRegistrationAcknowledgement,
  type ProfileRegistrationRequest,
} from '@trefaro/shared-models';
import {
  ImageFileService,
  type ImageBytes,
  type ImageUpload,
} from '../common/image-file.service';
import { PasswordHasher } from '../common/password-hasher.service';
import {
  describePasswordPolicy,
  isUsablePassword,
} from '../common/password-policy';
import { ConfigurationService } from '../config';
import { MailDeliveryError, MailService, PublicLinks } from '../mail';
import { CONFIRMATION_TOKEN_TTL_MS, TokenSigner } from '../security';
import { avatarUrl } from './avatar-url';
import type { AuthenticatedParticipant } from './ports/user-session.repository';
import {
  USER_PROFILE_REPOSITORY,
  type UserProfileRecord,
  type UserProfileRepository,
} from './ports/user-profile.repository';
import { ProfileFieldsService } from './profile-fields.service';
import { UserSessionService } from './user-session.service';

/**
 * What a login attempt found.
 *
 * Three outcomes rather than a nullable profile, because the middle one is a
 * real state with its own answer: the credentials were right, but the address
 * has not been confirmed. Telling that person "wrong e-mail or password" would
 * leave them stuck with nothing to fix — and it reveals nothing, since anyone
 * who can produce the right password already knows the account exists.
 */
export type ParticipantCredentialCheck =
  | { readonly outcome: 'authenticated'; readonly profile: UserProfileRecord }
  | { readonly outcome: 'unconfirmed' }
  | { readonly outcome: 'rejected' };

/** Said the same way wherever a profile cannot be found any more. */
const GONE = 'This account no longer exists.';

/** The subtree of the upload volume profile pictures live in (F124, E19). */
const AVATAR_AREA = 'avatars';

/**
 * Participant accounts (FR 4.1, FR 4.2, UC 09).
 *
 * Four properties of this flow are load-bearing:
 *
 * 1. **The address is the identity** (E31). It is unique instance-wide, it is
 *    what registrations are found by, and it cannot be changed — which is why
 *    nothing here writes it after creation.
 * 2. **An account comes into being like a registration: with double opt-in**
 *    (E32). The same signed token, the same mail machinery, and no session
 *    before `confirmedAt` — otherwise the confirmation would be decorative.
 * 3. **The answer never varies** (E32, E10 applied to accounts). Unknown
 *    address, unconfirmed address, long-confirmed address: the caller gets the
 *    same acknowledgement. What differs is the message that goes out, and only
 *    its recipient reads it. Anything else turns this form into a query for who
 *    has an account here.
 * 4. **A repeated attempt never creates a second row.** The unique index decides
 *    that; this service reacts by sending the mail that fits the state the
 *    address is already in.
 *
 * Since AP 2 it also owns the profile behind the account (FR 4.3): the name, the
 * language, the field of activity, the answers to the instance's questions, the
 * visibility switch, the password, and the picture. That is one aggregate — one
 * row of `user_profile` — so it is one service, the same way `EventsService`
 * owns an event down to its logo. Three of those are worth their own note:
 *
 * - **`searchable` is writable here and does nothing yet.** AP 5 builds the
 *   search that reads it. Storing the decision before there is anything to find
 *   is the right order: the switch is the person's, and a profile created today
 *   should not become findable the day the search ships.
 * - **The picture is written in two steps and never through a form** (F116,
 *   F124): the file exists before the column names it, and the column is
 *   changed only by `setAvatarPath`.
 * - **A password change ends the other sessions**, because somebody changing
 *   their password has said something about their other devices too.
 */
@Injectable()
export class ProfilesService {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly profiles: UserProfileRepository,
    private readonly hasher: PasswordHasher,
    private readonly mail: MailService,
    private readonly tokens: TokenSigner,
    // Absolute addresses into the participant client; both account mails need one.
    private readonly links: PublicLinks,
    // For the instance's default language, which a form need not send.
    private readonly configuration: ConfigurationService,
    // The profile's configurable answers are checked against the definitions
    // and never against a DTO (E35) — this is who holds them.
    private readonly fields: ProfileFieldsService,
    // The bytes of the picture: what may be uploaded, and where it is kept.
    private readonly images: ImageFileService,
    // A password change ends the other sessions of the same account.
    private readonly sessions: UserSessionService,
  ) {}

  async register(
    input: ProfileRegistrationRequest,
  ): Promise<ProfileRegistrationAcknowledgement> {
    // Before anything is written or sent: a password the policy rejects is a
    // form error, not a secret. The DTO checks the same bounds; this is the
    // check that also covers callers that are not the DTO.
    if (!isUsablePassword(input.password)) {
      throw new BadRequestException(describePasswordPolicy());
    }

    const email = normalizeEmail(input.email);
    const existing = await this.profiles.findByEmail(email);

    // A confirmed account is never rewritten by a public request: this endpoint
    // is unauthenticated, and anyone who knows an address could otherwise
    // replace its password.
    if (existing?.confirmedAt) {
      await this.tellThemItExists(existing);
      return { email };
    }

    const profile = existing
      ? await this.reuse(existing, input)
      : await this.add(email, input);

    await this.requestConfirmation(profile);
    return { email };
  }

  /**
   * Turns an unconfirmed account into a confirmed one — and nothing else.
   *
   * Idempotent by design: people click a link twice, and forwarded mail gets
   * opened by a colleague. Only unconfirmed → confirmed is a transition; a
   * second click reports what is already true instead of failing (E5b).
   */
  async confirm(token: string): Promise<ProfileConfirmation> {
    const id = this.tokens.verify('profile-confirmation', token);
    if (!id) {
      throw new BadRequestException(
        'This confirmation link is not valid any more. Please create your account again to receive a new one.',
      );
    }

    const profile = await this.require(id);
    if (profile.confirmedAt) {
      return { state: 'already-confirmed', firstName: profile.firstName };
    }

    const confirmed = await this.profiles.update(profile.id, {
      confirmedAt: new Date(),
    });
    if (!confirmed) throw new NotFoundException(GONE);

    // No receipt mail: the receipt for an account is being able to log in, and
    // a message that says so would be a letter nobody needs.
    return { state: 'confirmed', firstName: confirmed.firstName };
  }

  /**
   * Verifies credentials (FR 4.2).
   *
   * Never says *why* it failed, with one deliberate exception: an account whose
   * address is not confirmed yet is reported as such — see
   * {@link ParticipantCredentialCheck}.
   */
  async checkCredentials(
    email: string,
    password: string,
  ): Promise<ParticipantCredentialCheck> {
    const profile = await this.profiles.findByEmail(normalizeEmail(email));

    if (!profile) {
      // Same cost as a real check, so the response time says nothing.
      await this.hasher.equalizeTiming(password);
      return { outcome: 'rejected' };
    }

    if (!(await this.hasher.verify(profile.passwordHash, password))) {
      return { outcome: 'rejected' };
    }

    if (!profile.confirmedAt) return { outcome: 'unconfirmed' };
    return { outcome: 'authenticated', profile };
  }

  async require(id: string): Promise<UserProfileRecord> {
    const found = await this.profiles.findById(id);
    if (!found) throw new NotFoundException(GONE);
    return found;
  }

  /**
   * Changes the profile (FR 4.3).
   *
   * Partial at the top level — an absent property is one the form did not
   * touch — and whole for `customFields`: the answers are checked against the
   * definitions as a set, because "required" is a property of the form and
   * cannot be judged on a fragment of it (E35). Leaving `customFields` out
   * therefore means "the answers stay as they are", not "the answers are gone".
   *
   * The address is not among the things that can change (E31), and neither is
   * the picture — that is `setAvatar`, because bytes are not a form field
   * (F116).
   */
  async updateProfile(
    id: string,
    update: ParticipantProfileUpdate,
  ): Promise<UserProfileRecord> {
    const changes = {
      ...(update.firstName === undefined
        ? {}
        : { firstName: required(update.firstName, 'first name') }),
      ...(update.lastName === undefined
        ? {}
        : { lastName: required(update.lastName, 'last name') }),
      ...(update.preferredLocale === undefined
        ? {}
        : { preferredLocale: update.preferredLocale.trim().toLowerCase() }),
      ...(update.activityAreas === undefined
        ? {}
        : { activityAreas: activityAreas(update.activityAreas) }),
      ...(update.customFields === undefined
        ? {}
        : {
            customFields: await this.fields.validateAnswers(
              update.customFields,
            ),
          }),
      ...(update.searchable === undefined
        ? {}
        : { searchable: update.searchable }),
    };

    const updated = await this.profiles.update(id, changes);
    if (!updated) throw new NotFoundException(GONE);
    return updated;
  }

  /**
   * Changes the password from inside the profile (FR 4.3).
   *
   * With the current one, which is what makes this a change and not a reset:
   * whoever is holding this session may have found it unlocked. The old
   * password is verified against the stored hash rather than against anything
   * the session carries.
   *
   * Afterwards every **other** session of this account ends. That is the part
   * that makes the feature protective rather than cosmetic — somebody who
   * changes their password because a device is not theirs any more has said
   * something about that device too.
   */
  async changePassword(
    current: AuthenticatedParticipant,
    change: ParticipantPasswordChange,
  ): Promise<void> {
    if (
      !(await this.hasher.verify(
        current.profile.passwordHash,
        change.currentPassword,
      ))
    ) {
      throw new UnauthorizedException('The current password is not right.');
    }

    if (!isUsablePassword(change.newPassword)) {
      throw new BadRequestException(describePasswordPolicy());
    }

    const updated = await this.profiles.update(current.profile.id, {
      passwordHash: await this.hasher.hash(change.newPassword),
    });
    if (!updated) throw new NotFoundException(GONE);

    await this.sessions.revokeOthers(current.profile.id, current.sessionId);
  }

  /**
   * Replaces the profile picture (FR 4.3, F124).
   *
   * The same three writes in the same order as a series or event logo, and for
   * the same reason: the file exists before any column points at it, so a
   * failure to write the row leaves an unreferenced file rather than a row
   * pointing at nothing. The previous file goes last, once nothing names it.
   *
   * @returns the new public URL of the picture.
   */
  async setAvatar(id: string, upload: ImageUpload): Promise<string | null> {
    const existing = await this.require(id);
    const stored = await this.images.store(AVATAR_AREA, upload);

    let updated: UserProfileRecord | null;
    try {
      updated = await this.profiles.setAvatarPath(id, stored);
    } catch (error: unknown) {
      await this.images.discard([stored]);
      throw error;
    }

    if (!updated) {
      await this.images.discard([stored]);
      throw new NotFoundException(GONE);
    }

    await this.images.discard([existing.avatarPath]);
    return avatarUrl(updated.id, updated.avatarPath, updated.updatedAt);
  }

  /** Takes the picture away; the column is cleared before the file goes. */
  async removeAvatar(id: string): Promise<null> {
    // The path to unlink has to be read before the write — afterwards the row
    // answers `null` for it.
    const existing = await this.require(id);

    if (!(await this.profiles.setAvatarPath(id, null))) {
      throw new NotFoundException(GONE);
    }

    await this.images.discard([existing.avatarPath]);
    return null;
  }

  /**
   * The bytes behind `GET /api/media/profiles/:id/avatar`.
   *
   * No session check and no `searchable` check, which is the one place in this
   * phase where a media route meets personal data. Two of F115's three
   * arguments do not carry here — an avatar *is* participant data, and there is
   * no organizer preview to keep working — so the decision rests on the other
   * one and on E34: the address needs the account's uuid, which is handed out
   * only with a profile the asker may already see, and the alternative would be
   * a guard that accepts either the participant's or the organizer's cookie.
   * That is exactly the guard E34 exists to prevent, and two routes to the same
   * bytes is what E19 exists to prevent.
   */
  async readAvatar(id: string): Promise<ImageBytes | null> {
    const found = await this.profiles.findById(id);
    if (!found) return null;
    return this.images.read(AVATAR_AREA, found.avatarPath);
  }

  private async add(
    email: string,
    input: ProfileRegistrationRequest,
  ): Promise<UserProfileRecord> {
    return this.profiles.create({
      email,
      passwordHash: await this.hasher.hash(input.password),
      preferredLocale: await this.localeFor(input),
      ...personalDetails(input),
    });
  }

  /**
   * A repeated attempt on an address whose account is not confirmed yet.
   *
   * Still being written, so a corrected name — or a password typed properly the
   * second time — is applied. That is safe precisely because the address is
   * unconfirmed: no session has ever been issued for it, so there is nothing
   * that overwriting the password could take away from anybody.
   */
  private async reuse(
    existing: UserProfileRecord,
    input: ProfileRegistrationRequest,
  ): Promise<UserProfileRecord> {
    return (
      (await this.profiles.update(existing.id, {
        passwordHash: await this.hasher.hash(input.password),
        preferredLocale: await this.localeFor(input),
        ...personalDetails(input),
      })) ?? existing
    );
  }

  private async requestConfirmation(profile: UserProfileRecord): Promise<void> {
    const token = this.tokens.sign(
      'profile-confirmation',
      profile.id,
      CONFIRMATION_TOKEN_TTL_MS,
    );

    try {
      await this.mail.sendProfileConfirmation(profile.email, {
        firstName: profile.firstName,
        confirmUrl: this.links.token(PROFILE_CONFIRMATION_PATH, token),
      });
    } catch (error: unknown) {
      if (!(error instanceof MailDeliveryError)) throw error;
      throw undeliverable();
    }
  }

  private async tellThemItExists(profile: UserProfileRecord): Promise<void> {
    try {
      await this.mail.sendProfileExists(profile.email, {
        firstName: profile.firstName,
        loginUrl: this.links.url(PROFILE_LOGIN_PATH),
      });
    } catch (error: unknown) {
      if (!(error instanceof MailDeliveryError)) throw error;
      // The same failure as above gets the same answer, although this account
      // is perfectly intact: an error that appeared for a known address and not
      // for an unknown one would be the disclosure E32 exists to prevent.
      throw undeliverable();
    }
  }

  /** The language to write to this person in — theirs, or the instance's (F90). */
  private async localeFor(input: ProfileRegistrationRequest): Promise<string> {
    const requested = input.preferredLocale?.trim();
    if (requested) return requested.toLowerCase();
    const { defaultLocale } = await this.configuration.getLocaleSettings();
    return defaultLocale;
  }
}

/** One sentence for both mail failures, so the two are indistinguishable (E32). */
function undeliverable(): ServiceUnavailableException {
  return new ServiceUnavailableException(
    'The confirmation e-mail could not be sent. Please try again in a moment.',
  );
}

/** Addresses are compared and stored in one form; see `NewUserProfile.email`. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A name somebody is addressed by — trimmed, and never emptied. */
function required(value: string, what: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new BadRequestException(`Please give your ${what}.`);
  }
  return trimmed;
}

/**
 * The field of activity, or nothing (E36).
 *
 * An emptied field means "no longer stated" and is stored as `null`, so the
 * search has one thing to test rather than two — and so nobody's profile says
 * they work on the empty string.
 */
function activityAreas(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_ACTIVITY_AREAS_LENGTH) {
    throw new BadRequestException(
      `Please keep the field of activity to ${MAX_ACTIVITY_AREAS_LENGTH} characters.`,
    );
  }
  return trimmed;
}

function personalDetails(input: ProfileRegistrationRequest) {
  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
  };
}
