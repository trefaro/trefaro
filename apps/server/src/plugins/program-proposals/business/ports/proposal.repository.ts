import type { ProposalStatus } from '@trefaro/shared-models';

/**
 * Port for programme proposal storage (FR 3.13, FR 3.14).
 *
 * A plug-in mirrors the server's layering internally: this interface is its
 * business layer, and `data-access/typeorm-proposal.repository.ts` implements
 * it. What that buys is visible in the service beside it — no ORM import, and
 * no knowledge of a core table anywhere in it.
 *
 * What the port deliberately does not offer is a way to read an event, an
 * account or a programme item. A proposal belongs to an event and to a person,
 * and both of those are core tables the plug-in owns nothing of (F21): the
 * references are enforced by the database, and what the plug-in knows about the
 * person is a name it asks the host for (E58).
 *
 * Two rules live in the statements rather than in a caller (F152):
 *
 * - **The visibility rule of E51.** {@link findForParticipant} carries
 *   `status = 'approved' OR author_id = :viewer` in the statement, so there is
 *   no way to ask this port for somebody else's pending proposal — which is the
 *   one mistake that would publish a rejected row.
 * - **A decision has a time.** {@link decide} writes the status and the instant
 *   together, because the table's check constraint refuses any other
 *   combination and a caller that wrote them separately would find out in
 *   production.
 */

/** One proposal as the business layer sees it — no ORM types. */
export interface ProposalRecord {
  readonly id: string;
  readonly eventId: string;
  readonly authorId: string;
  readonly title: string;
  readonly description: string;
  readonly status: ProposalStatus;
  /** `null` while it is pending — the pair the check constraint enforces. */
  readonly decidedAt: Date | null;
  /** Who decided, or `null` if that account is gone (`ON DELETE SET NULL`). */
  readonly decidedBy: string | null;
  readonly createdAt: Date;
}

export interface CreateProposalInput {
  readonly eventId: string;
  readonly authorId: string;
  readonly title: string;
  readonly description: string;
}

/** The window a list reads, already resolved from what a client asked for. */
export interface ProposalWindow {
  readonly offset: number;
  readonly limit: number;
}

/** One page, with what the pages divide counted in the same statement. */
export interface ProposalSlice {
  readonly rows: readonly ProposalRecord[];
  readonly total: number;
}

/**
 * Raised when the event or the account a proposal points at does not exist.
 *
 * Both foreign keys cascade, so the case is narrow: an event deleted between
 * the page load and the submission, or an account closed in the same moment.
 * The data access layer translates the constraint violation into this error so
 * the business layer can answer 404 rather than 500 — the driver's error code
 * stays where the ORM does.
 */
export class UnknownProposalTargetError extends Error {
  constructor(readonly eventId: string) {
    super('No such event, or no such account');
    this.name = 'UnknownProposalTargetError';
  }
}

export interface ProposalRepository {
  /**
   * What one participant may see of one event's proposals (E51, E58).
   *
   * Approved proposals of everyone, plus every proposal of the reader's own
   * whatever its status — that is the whole of FR 3.14's promise that the
   * status stays visible to the person who submitted it.
   */
  findForParticipant(
    eventId: string,
    viewerId: string,
    window: ProposalWindow,
  ): Promise<ProposalSlice>;

  /**
   * The organizer's moderation list for one event, optionally by status.
   *
   * No visibility filter: the organization moderates, so it sees everything of
   * its own event. `status` absent means every state, which is the list an
   * organizer reads when they want the history rather than the queue.
   */
  findForEvent(
    eventId: string,
    status: ProposalStatus | undefined,
    window: ProposalWindow,
  ): Promise<ProposalSlice>;

  findById(id: string): Promise<ProposalRecord | null>;

  /**
   * How many proposals of one event are in each state (E59).
   *
   * Counted in one statement, grouped by status: the alternative is three
   * queries for three numbers that belong in one heading, and the one after
   * that is reading every row to count them in TypeScript (F49). A state with
   * no rows is absent from the result and the caller fills in a zero — SQL
   * groups what is there, not what could have been.
   */
  countByStatus(eventId: string): Promise<ReadonlyMap<ProposalStatus, number>>;

  /** @throws UnknownProposalTargetError */
  create(input: CreateProposalInput): Promise<ProposalRecord>;

  /**
   * Records one decision (E51).
   *
   * `null` when the row was already gone. Writing an already-decided row again
   * is allowed and moves the instant: a decision may be corrected, and refusing
   * a correction would need a reason FR 3.14 does not give.
   */
  decide(
    id: string,
    status: Exclude<ProposalStatus, 'pending'>,
    decidedAt: Date,
    decidedBy: string,
  ): Promise<ProposalRecord | null>;
}

export const PROPOSAL_REPOSITORY = Symbol('TREFARO_PROPOSAL_REPOSITORY');
