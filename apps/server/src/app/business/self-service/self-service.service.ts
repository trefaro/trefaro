import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MyProgramItem,
  MyRegistration,
  MyRegistrationPage,
  MyRegistrationSummary,
  PublicProgramItem,
} from '@trefaro/shared-models';
import {
  DEFAULT_MY_REGISTRATION_PAGE_SIZE,
  MAX_MY_REGISTRATION_PAGE_SIZE,
} from '@trefaro/shared-models';
import { pageWindow } from '../common/page-window';
import { EventsService, type EventLocation } from '../events';
import { ProgramService, ProgramSignupsService } from '../program';
import { ParticipantsService } from '../registration';
import {
  REGISTRATION_REPOSITORY,
  type RegistrationRecord,
  type RegistrationRepository,
} from '../registration/ports/registration.repository';
import { TokenSigner } from '../security';

/**
 * How a request proves that it may act on one registration (E11, E31).
 *
 * Two ways, one set of rules. The **link** from the confirmation receipt is the
 * one phase 1 shipped, and it stays valid — that was the promise (E11): it
 * speaks for exactly one registration, and whoever holds it may use it. The
 * **account** is the second way phase 3 adds: a session says who somebody is,
 * and the registrations of a person are the ones carrying their address, since
 * there is no `user_id` to join on (E31).
 *
 * What deliberately does *not* differ between them is everything below
 * {@link SelfServiceService.require}: the same states are usable, the same ones
 * are refused, and the same operations follow. Two claims on one registration,
 * not two ways through the rules — a second rule set would be a second place
 * for them to drift, and the one that drifts is the one nobody is reading.
 */
export type SelfServiceClaim =
  | { readonly kind: 'link'; readonly token: string }
  | {
      readonly kind: 'account';
      /** The address of the session making the claim (E31). */
      readonly email: string;
      readonly registrationId: string;
    };

/** The claim a mailed link makes: this one registration, for whoever holds it. */
export function byLink(token: string): SelfServiceClaim {
  return { kind: 'link', token };
}

/** The claim a session makes: this registration, if it is mine (E31). */
export function byAccount(
  email: string,
  registrationId: string,
): SelfServiceClaim {
  return { kind: 'account', email, registrationId };
}

/**
 * "My registration" — what a participant may do with their own (E11, FR 4.7).
 *
 * FR 3.10 is P1 and the participant login is P2, so phase 1 bridged the gap with
 * the signed link in the confirmation receipt. AP 4 of phase 3 adds the second
 * way — a session — and this service is still the whole of it, deliberately
 * thin: it turns a {@link SelfServiceClaim} into one registration and then
 * delegates every rule to the module that owns it — the programme decides what
 * a seat costs, the events module decides what may be shown.
 *
 * What a claim does *not* do is authorize anything beyond one registration.
 * Three properties enforce that:
 *
 * 1. **The purpose is inside the signature.** A confirmation link cannot be
 *    replayed here, and this link cannot confirm an address — confirming is the
 *    one thing only the person behind the address may do (F31), and it has
 *    already happened by the time this link exists.
 * 2. **Only a confirmed registration has a self-service view.** A cancelled one
 *    says so instead, because a link that silently kept working after a
 *    cancellation would let somebody take seats for a registration that no
 *    longer stands.
 * 3. **Nothing here reads a second registration.** Not even to count: the page
 *    shows how many seats a session has taken, which comes from the programme,
 *    and never who took them.
 *
 * The login went in front of the same operations without changing any of them:
 * it resolves the registration instead of the token, and the links already in
 * people's inboxes keep working — that is what E11 promised. Cancelling one's
 * own registration through the session is the one operation the session cannot
 * do yet; it belongs to AP 12 together with the rest of FR 4.7, and the link
 * can do it today.
 */
@Injectable()
export class SelfServiceService {
  constructor(
    @Inject(REGISTRATION_REPOSITORY)
    private readonly registrations: RegistrationRepository,
    private readonly events: EventsService,
    private readonly program: ProgramService,
    private readonly signups: ProgramSignupsService,
    // For the cancellation, so the status transitions live in one place (E14):
    // an organizer cancelling and a participant cancelling must not be able to
    // mean two different things.
    private readonly participants: ParticipantsService,
    private readonly tokens: TokenSigner,
  ) {}

  /**
   * The participant's own registration and the programme, with their seats.
   *
   * `locale` is carried through every operation below, not just this one: all
   * four answer with the whole view, and a page that fell back to English the
   * moment somebody claimed a seat would be a page that changes language when it
   * is used.
   */
  async view(
    claim: SelfServiceClaim,
    locale?: string,
  ): Promise<MyRegistration> {
    return this.compose(await this.require(claim), locale);
  }

  /**
   * Every registration this address holds, newest event first (FR 4.7, E31).
   *
   * The list a logged-in participant reaches from the navigation, and the one
   * screen of this service a link cannot open: a token speaks for one
   * registration, and a person is not a registration.
   *
   * Every state is listed. `pending` and `cancelled` are exactly the two that
   * make somebody come here and ask, so leaving them out would leave out the
   * answer — the rows say which is which, and {@link view} keeps its rules
   * about what may then be *done* with them.
   */
  async listFor(
    email: string,
    query: { readonly page?: number; readonly pageSize?: number },
    locale?: string,
  ): Promise<MyRegistrationPage> {
    const { page, pageSize, offset } = pageWindow(
      query,
      DEFAULT_MY_REGISTRATION_PAGE_SIZE,
      MAX_MY_REGISTRATION_PAGE_SIZE,
    );

    const slice = await this.registrations.searchByAddress({
      email: email.trim().toLowerCase(),
      offset,
      limit: pageSize,
    });

    // One lookup for the whole page: a list of registrations that named its
    // events one query at a time would be N+1 (F49).
    const events = await this.events.locateMany(
      slice.rows.map((row) => row.eventId),
      locale,
    );

    return {
      rows: slice.rows.flatMap((row) => {
        const located = events.get(row.eventId);
        // Cannot happen through the foreign key, and left out rather than
        // guessed at if it ever does: a row without its event has nothing to
        // name on screen.
        return located ? [toSummary(row, located)] : [];
      }),
      total: slice.total,
      page,
      pageSize,
    };
  }

  /**
   * Claims a seat in one session (FR 3.10).
   *
   * Answers with the whole view rather than with the one item: a seat can be
   * taken between rendering the page and pressing the button, so the page that
   * just claimed the last one has to be able to say what is left.
   */
  async signUp(
    itemId: string,
    claim: SelfServiceClaim,
    locale?: string,
  ): Promise<MyRegistration> {
    const registration = await this.require(claim);
    await this.signups.signUp(itemId, {
      registrationId: registration.id,
      eventId: registration.eventId,
    });
    return this.compose(registration, locale);
  }

  async signOff(
    itemId: string,
    claim: SelfServiceClaim,
    locale?: string,
  ): Promise<MyRegistration> {
    const registration = await this.require(claim);
    await this.signups.signOff(itemId, {
      registrationId: registration.id,
      eventId: registration.eventId,
    });
    return this.compose(registration, locale);
  }

  /**
   * Cancels the participant's own registration (E11, E14).
   *
   * Cancelled, not deleted: the row is the record of the opt-in this
   * organization can show (F23), and the seat is demonstrably free without it
   * disappearing. Erasure is a separate request to the organizer and the subject
   * of the phase 5 functions.
   *
   * The seats in individual sessions go with it. Somebody who is not coming is
   * not coming to the workshop either, and leaving those rows would keep a
   * workshop full for a person who cancelled.
   */
  async cancel(
    claim: SelfServiceClaim,
    locale?: string,
  ): Promise<MyRegistration> {
    const registration = await this.require(claim);

    for (const itemId of await this.signups.seatsOf(registration.id)) {
      await this.signups.signOff(itemId, {
        registrationId: registration.id,
        eventId: registration.eventId,
      });
    }

    // The participant is cancelling on their own page and reads the answer
    // there, so no notice goes out (F59).
    await this.participants.setStatus(
      registration.id,
      'cancelled',
      'participant',
    );

    const cancelled = await this.registrations.findById(registration.id);
    if (!cancelled) throw new NotFoundException(GONE);
    return this.compose(cancelled, locale);
  }

  /**
   * The registration a claim speaks for — and the rules both claims share.
   *
   * The two ways in differ only in how the row is found and in what a failure
   * to find it says; from the status check down they are the same code, which
   * is the point of E11's promise.
   */
  private async require(claim: SelfServiceClaim): Promise<RegistrationRecord> {
    const registration =
      claim.kind === 'link'
        ? await this.fromLink(claim.token)
        : await this.fromAccount(claim.email, claim.registrationId);

    if (registration.status === 'cancelled') {
      throw new ConflictException(
        'This registration was cancelled. Please register again if you would ' +
          'like to take part after all.',
      );
    }
    if (registration.status !== 'confirmed') {
      // The link is only ever mailed after a confirmation, so this is a
      // registration an organizer reset — and the way back is the confirmation
      // mail, not this page.
      throw new ConflictException(
        'This registration is not confirmed yet. Please use the confirmation ' +
          'link from your e-mail first.',
      );
    }
    return registration;
  }

  /**
   * The registration a token speaks for.
   *
   * One message for every way a token can fail to name a usable registration —
   * forged, expired, or pointing at a row that has since been deleted. The
   * difference is not the holder's to learn, and it does not change what they
   * can do about it (the same reasoning as {@link TokenSigner.verify}).
   */
  private async fromLink(token: string): Promise<RegistrationRecord> {
    const id = this.tokens.verify('registration-self-service', token);
    if (!id) throw new BadRequestException(INVALID_LINK);

    const registration = await this.registrations.findById(id);
    if (!registration) throw new BadRequestException(INVALID_LINK);
    return registration;
  }

  /**
   * The registration of this address with this id, if it is theirs (E31).
   *
   * A 404 both for an id nothing matches and for one that belongs to somebody
   * else, worded identically: a logged-in participant must not be able to
   * discover which registrations exist by watching the difference. That is the
   * same reasoning the link path uses for its one message, applied to the
   * question a session can ask.
   *
   * Compared case-insensitively, because an address is the identity and
   * identities are not case-sensitive (E31) — the registration table stores
   * addresses normalized, the profile table stores them as typed.
   */
  private async fromAccount(
    email: string,
    registrationId: string,
  ): Promise<RegistrationRecord> {
    const registration = await this.registrations.findById(registrationId);
    if (!registration || !sameAddress(registration.email, email)) {
      throw new NotFoundException(NOT_YOURS);
    }
    return registration;
  }

  private async compose(
    registration: RegistrationRecord,
    locale?: string,
  ): Promise<MyRegistration> {
    const { event, seriesSlug } = await this.events.locate(
      registration.eventId,
      locale,
    );
    // By id and not through the public address: an event that went back to being
    // a draft must not turn a self-service link into an error, for the same
    // reason `locate` above does not check its status.
    const [items, seats] = await Promise.all([
      this.program.listForEvent(registration.eventId, locale),
      this.signups.seatsOf(registration.id),
    ]);

    return {
      firstName: registration.firstName,
      lastName: registration.lastName,
      email: registration.email,
      status: registration.status,
      registeredAt: registration.createdAt.toISOString(),
      confirmedAt: registration.confirmedAt?.toISOString() ?? null,
      customFields: registration.customFields,
      seriesSlug,
      event,
      program: items.map((item) => withSeat(item, seats)),
    };
  }
}

const GONE = 'This registration no longer exists.';

/**
 * Said the same way for an unknown registration and for somebody else's.
 *
 * "No registration of yours has that id" is true in both cases and gives away
 * neither — the alternative tells a logged-in participant which ids exist.
 */
const NOT_YOURS = 'You have no registration with that id.';

const INVALID_LINK =
  'This link is not valid any more. Ask the organizer to send your ' +
  'registration details again.';

function withSeat(
  item: PublicProgramItem,
  seats: ReadonlySet<string>,
): MyProgramItem {
  return { ...item, signedUp: seats.has(item.id) };
}

/** One row of "my registrations", with the event it is for (FR 4.7). */
function toSummary(
  registration: RegistrationRecord,
  located: EventLocation,
): MyRegistrationSummary {
  return {
    id: registration.id,
    status: registration.status,
    registeredAt: registration.createdAt.toISOString(),
    confirmedAt: registration.confirmedAt?.toISOString() ?? null,
    seriesSlug: located.seriesSlug,
    event: located.event,
  };
}

/** An address is the identity, and identities are not case-sensitive (E31). */
function sameAddress(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}
