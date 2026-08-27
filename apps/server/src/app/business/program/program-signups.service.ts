import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ProgramItemLoad } from '@trefaro/shared-models';
import {
  PROGRAM_ITEM_SIGNUP_REPOSITORY,
  type ProgramItemSignupRepository,
} from './ports/program-item-signup.repository';
import {
  PROGRAM_ITEM_REPOSITORY,
  type ProgramItemRecord,
  type ProgramItemRepository,
} from './ports/program-item.repository';

/** Whose registration is claiming a seat — resolved by the caller. */
export interface SignUpActor {
  readonly registrationId: string;
  /** The event the registration is for; a session of another event is not theirs. */
  readonly eventId: string;
}

/**
 * Claiming and giving up a seat in a single session (FR 3.10) — AP 9.
 *
 * Separate from {@link ProgramService}, which plans the programme: this is the
 * participant's side of it, and the two are read by different people through
 * different doors. Everything here is decided by the session and the
 * registration, never by who is asking — the caller has already established
 * *that* (a signed link in phase 1, a login from phase 3), and this service
 * would be wrong to care which.
 *
 * The rules, and why each is the way it is:
 *
 * 1. **A session of another event does not exist.** Not "forbidden": a link that
 *    reached the wrong inbox must not be able to enumerate other events'
 *    programmes, and the answer is the same as for an id that never existed.
 * 2. **Sign-up has to be switched on.** Most sessions are simply attended; a
 *    seat in one that never asked for one is meaningless.
 * 3. **A session that has ended takes no more sign-ups.** Nobody attends the
 *    past, and a list of sign-ups after the fact is not attendance — the
 *    QR check-in plug-in (phase 4) is what records that.
 * 4. **A full session takes none either** — the acceptance criterion of AP 9.
 *    Whether it is full is decided when the seat is written, not when the page
 *    was rendered.
 * 5. **Giving up a seat always works.** Even in a session whose sign-up an
 *    organizer has since switched off, and even after it has started: somebody
 *    who cannot come says so, and a rule that traps people in a list is a rule
 *    that makes the list wrong.
 * 6. **Both directions are idempotent.** People click twice and leave two tabs
 *    open. Having a seat is the outcome of signing up, whether this request was
 *    the one that created it.
 */
@Injectable()
export class ProgramSignupsService {
  constructor(
    @Inject(PROGRAM_ITEM_REPOSITORY)
    private readonly items: ProgramItemRepository,
    @Inject(PROGRAM_ITEM_SIGNUP_REPOSITORY)
    private readonly signups: ProgramItemSignupRepository,
  ) {}

  /** The sessions this registration holds a seat in. */
  async seatsOf(registrationId: string): Promise<ReadonlySet<string>> {
    const rows = await this.signups.findByRegistration(registrationId);
    return new Set(rows.map((row) => row.programItemId));
  }

  /** @throws ConflictException when the session is closed, over or full. */
  async signUp(itemId: string, actor: SignUpActor): Promise<void> {
    const item = await this.require(itemId, actor.eventId);

    if (!item.registrationEnabled) {
      throw new ConflictException(
        `"${item.title}" does not ask for sign-up — just come along.`,
      );
    }
    if (item.endsAt.getTime() <= Date.now()) {
      throw new ConflictException(`"${item.title}" has already taken place.`);
    }

    const outcome = await this.signups.signUp({
      programItemId: item.id,
      registrationId: actor.registrationId,
      capacity: item.capacity,
    });

    if (outcome === 'full') {
      throw new ConflictException(
        `"${item.title}" is full. Someone may give up a seat — it is worth ` +
          'looking again later.',
      );
    }
  }

  /** Idempotent: no seat is the outcome either way (rule 5). */
  async signOff(itemId: string, actor: SignUpActor): Promise<void> {
    const item = await this.require(itemId, actor.eventId);
    await this.signups.signOff(item.id, actor.registrationId);
  }

  /**
   * Who is coming to one session, for the organizer (FR 3.10).
   *
   * With the addresses in the list rather than one click away — the single
   * correction the usability test of the thesis produced, and it holds wherever
   * an organizer looks at participants.
   */
  async load(itemId: string): Promise<ProgramItemLoad> {
    const item = await this.items.findById(itemId);
    if (!item) throw new NotFoundException(GONE);

    const participants = await this.signups.findParticipants(item.id);
    return {
      itemId: item.id,
      title: item.title,
      registrationEnabled: item.registrationEnabled,
      capacity: item.capacity,
      signupCount: participants.length,
      participants: participants.map((participant) => ({
        registrationId: participant.registrationId,
        firstName: participant.firstName,
        lastName: participant.lastName,
        email: participant.email,
        signedUpAt: participant.signedUpAt.toISOString(),
      })),
    };
  }

  /** The session, if it belongs to the caller's own event (rule 1). */
  private async require(
    itemId: string,
    eventId: string,
  ): Promise<ProgramItemRecord> {
    const item = await this.items.findById(itemId);
    if (!item || item.eventId !== eventId) {
      throw new NotFoundException(GONE);
    }
    return item;
  }
}

/**
 * Said the same way for an unknown session and for one that belongs to another
 * event — the difference is not the caller's to learn.
 */
const GONE = 'This session is not part of the programme you are looking at.';
