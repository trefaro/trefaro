import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  PROFILE_CONFIRMATION_PATH,
  PROFILE_LOGIN_PATH,
  type ProfileConfirmation,
  type ProfileRegistrationAcknowledgement,
  type ProfileRegistrationRequest,
} from '@trefaro/shared-models';
import { PasswordHasher } from '../common/password-hasher.service';
import {
  describePasswordPolicy,
  isUsablePassword,
} from '../common/password-policy';
import { ConfigurationService } from '../config';
import { MailDeliveryError, MailService, PublicLinks } from '../mail';
import { CONFIRMATION_TOKEN_TTL_MS, TokenSigner } from '../security';
import {
  USER_PROFILE_REPOSITORY,
  type UserProfileRecord,
  type UserProfileRepository,
} from './ports/user-profile.repository';

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

function personalDetails(input: ProfileRegistrationRequest) {
  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
  };
}
