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
  PublicProgramItem,
} from '@trefaro/shared-models';
import { EventsService } from '../events';
import { ProgramService, ProgramSignupsService } from '../program';
import { ParticipantsService } from '../registration';
import {
  REGISTRATION_REPOSITORY,
  type RegistrationRecord,
  type RegistrationRepository,
} from '../registration/ports/registration.repository';
import { TokenSigner } from '../security';

/**
 * "My registration" — what a participant may do without an account (E11).
 *
 * FR 3.10 is P1 and the participant login is P2, so phase 1 bridges the gap with
 * the signed link in the confirmation receipt. This service is the whole of that
 * bridge, and it is deliberately thin: it turns a token into one registration
 * and then delegates every rule to the module that owns it — the programme
 * decides what a seat costs, the events module decides what may be shown.
 *
 * What the token does *not* do is authorize anything beyond one registration.
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
 * Phase 3 puts the participant login in front of the same operations. Nothing
 * here has to change for that — the login resolves the registration instead of
 * the token, and these links keep working (that is what E11 promised).
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

  /** The participant's own registration and the programme, with their seats. */
  async view(token: string): Promise<MyRegistration> {
    return this.compose(await this.require(token));
  }

  /**
   * Claims a seat in one session (FR 3.10).
   *
   * Answers with the whole view rather than with the one item: a seat can be
   * taken between rendering the page and pressing the button, so the page that
   * just claimed the last one has to be able to say what is left.
   */
  async signUp(itemId: string, token: string): Promise<MyRegistration> {
    const registration = await this.require(token);
    await this.signups.signUp(itemId, {
      registrationId: registration.id,
      eventId: registration.eventId,
    });
    return this.compose(registration);
  }

  async signOff(itemId: string, token: string): Promise<MyRegistration> {
    const registration = await this.require(token);
    await this.signups.signOff(itemId, {
      registrationId: registration.id,
      eventId: registration.eventId,
    });
    return this.compose(registration);
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
  async cancel(token: string): Promise<MyRegistration> {
    const registration = await this.require(token);

    for (const itemId of await this.signups.seatsOf(registration.id)) {
      await this.signups.signOff(itemId, {
        registrationId: registration.id,
        eventId: registration.eventId,
      });
    }

    await this.participants.setStatus(registration.id, 'cancelled');

    const cancelled = await this.registrations.findById(registration.id);
    if (!cancelled) throw new NotFoundException(GONE);
    return this.compose(cancelled);
  }

  /**
   * The registration a token speaks for.
   *
   * One message for every way a token can fail to name a usable registration —
   * forged, expired, or pointing at a row that has since been deleted. The
   * difference is not the holder's to learn, and it does not change what they
   * can do about it (the same reasoning as {@link TokenSigner.verify}).
   */
  private async require(token: string): Promise<RegistrationRecord> {
    const id = this.tokens.verify('registration-self-service', token);
    if (!id) throw new BadRequestException(INVALID_LINK);

    const registration = await this.registrations.findById(id);
    if (!registration) throw new BadRequestException(INVALID_LINK);

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

  private async compose(
    registration: RegistrationRecord,
  ): Promise<MyRegistration> {
    const { event, seriesSlug } = await this.events.locate(
      registration.eventId,
    );
    // By id and not through the public address: an event that went back to being
    // a draft must not turn a self-service link into an error, for the same
    // reason `locate` above does not check its status.
    const [items, seats] = await Promise.all([
      this.program.listForEvent(registration.eventId),
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

const INVALID_LINK =
  'This link is not valid any more. Ask the organizer to send your ' +
  'registration details again.';

function withSeat(
  item: PublicProgramItem,
  seats: ReadonlySet<string>,
): MyProgramItem {
  return { ...item, signedUp: seats.has(item.id) };
}
