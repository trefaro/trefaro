import type { InvitationCounts } from '@trefaro/shared-models';

/**
 * Port for invitations to former participants (FR 2.4, F24).
 *
 * Two things this port deliberately does not do:
 *
 * - **It stores no addresses.** A recipient is a registration id; the address
 *   and the first name are read through that foreign key when the mail is
 *   composed (F55). So this feature keeps no second copy of anybody's contact
 *   details, and there is nothing here to keep in step when a registration is
 *   corrected or erased.
 * - **It keeps no progress counter.** How far a send has got is counted from the
 *   recipient rows ({@link InvitationRepository.countsFor}), so a crash in the
 *   middle cannot leave a number that disagrees with the rows it summarizes.
 */

/** The message, without its audience. */
export interface InvitationRecord {
  readonly id: string;
  readonly seriesId: string;
  readonly eventId: string | null;
  readonly subject: string;
  readonly body: string;
  readonly createdAt: Date;
  readonly finishedAt: Date | null;
}

export interface NewInvitation {
  readonly seriesId: string;
  /** An event of the same series, already checked by the service. */
  readonly eventId: string | null;
  readonly subject: string;
  readonly body: string;
  /**
   * Already validated against who may be written to (E15, F55).
   *
   * Written in the same transaction as the invitation: an invitation with no
   * recipients would be a message nobody ever receives and nothing would ever
   * pick it up again.
   */
  readonly registrationIds: readonly string[];
}

/**
 * One recipient the sender still has to write to.
 *
 * The address and the first name come from the registration by join, in the
 * data access layer — the business layer asks for "the next one" and receives
 * what a mail needs, without ever holding the whole audience in memory.
 */
export interface PendingRecipient {
  readonly id: string;
  readonly registrationId: string;
  readonly email: string;
  readonly firstName: string;
}

export interface InvitationSlice {
  readonly rows: readonly InvitationRecord[];
  readonly total: number;
}

export interface InvitationRepository {
  /** The invitation and its recipient rows, in one transaction. */
  create(invitation: NewInvitation): Promise<InvitationRecord>;
  findById(id: string): Promise<InvitationRecord | null>;
  /** One page of a series' invitations, newest first. */
  findBySeries(
    seriesId: string,
    offset: number,
    limit: number,
  ): Promise<InvitationSlice>;
  /**
   * Recipients, sent and failed for several invitations in one query.
   *
   * A map rather than an array, and missing entries mean zero: an invitation
   * whose recipients were all erased still has a row of its own.
   */
  countsFor(
    invitationIds: readonly string[],
  ): Promise<ReadonlyMap<string, InvitationCounts>>;
  /**
   * The next recipient of this invitation that has not been attempted yet.
   *
   * One at a time on purpose. The alternative — reading the audience in one go
   * — would hold every address of a two-hundred-person send in memory and, on a
   * crash, lose the knowledge of where it had got to.
   */
  nextPending(invitationId: string): Promise<PendingRecipient | null>;
  markSent(recipientId: string): Promise<void>;
  /** `failure` is shown to the organizer, so it is the mail server's own words. */
  markFailed(recipientId: string, failure: string): Promise<void>;
  /**
   * Stamps the invitation as finished — but only if nothing is pending.
   *
   * The condition is in the statement rather than in the caller: two senders
   * that somehow ran at once must not be able to declare a send finished while
   * the other one is still working through it.
   */
  finish(invitationId: string): Promise<void>;
  /**
   * Invitations that still have pending recipients, oldest first.
   *
   * What the sender asks for when the process starts: a send interrupted by a
   * restart continues instead of staying half-delivered forever.
   */
  unfinished(): Promise<readonly string[]>;
}

export const INVITATION_REPOSITORY = Symbol('TREFARO_INVITATION_REPOSITORY');
