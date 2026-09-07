import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_PROPOSAL_PAGE_SIZE,
  MAX_PROPOSAL_PAGE_SIZE,
  type NewProgramProposal,
  type ProgramProposal,
  type ProposalPage,
  type ProposalQuery,
  type ProposalStatus,
  type ProposalSummary,
} from '@trefaro/shared-models';
import {
  PLUGIN_PARTICIPANT_READS,
  pageWindow,
  type PageWindow,
  type PluginAuthor,
  type PluginParticipantReads,
} from '../../../app/business/plugin-api';
import {
  PROPOSAL_REPOSITORY,
  UnknownProposalTargetError,
  type ProposalRecord,
  type ProposalRepository,
} from './ports/proposal.repository';

/**
 * Programme proposals (FR 3.13, FR 3.14).
 *
 * The first plug-in built against the extended contract, and what it uses of it
 * is exactly two things: who is asking, and what an author is called. Neither
 * is available any other way — a plug-in owns its own tables and reads no core
 * table (F21) — so both arrive through `plugin-api`, and this file contains no
 * ORM import, no core entity and no knowledge of `user_profile`.
 *
 * Five decisions worth naming:
 *
 * 1. **A proposal is pending until somebody decides** (E51), and a decision is
 *    a route rather than a field in a `PATCH`: `POST …/approval` and
 *    `POST …/rejection`. Three states, one instant, one organizer — no comment
 *    thread on the decision, no second reviewer, and no notification chain. The
 *    survey asked in as many words for the moderation effort to stay minimal.
 * 2. **A rejected proposal stays** (E14) and keeps showing its status to the
 *    person who wrote it, which is what FR 3.14 asks for. Deleting it would
 *    make a refusal indistinguishable from a submission that never arrived.
 * 3. **An approved proposal does not become a programme item** (E52). The
 *    approval **publishes** it; creating the session stays the organizer's own
 *    action in the programme editor. A write port into `program_item` would be
 *    the first capability with which a plug-in changes core data — introduced
 *    for a plug-in an organizer can switch off, which would leave sessions in
 *    the database whose origin is disabled.
 * 4. **Names are resolved once per page** (F49). One call to the host port for
 *    the whole list rather than one per row; an id it cannot resolve is left
 *    without an author rather than given a placeholder name.
 * 5. **The count is the plug-in's, not the host's** (E59). {@link summarize}
 *    answers the heading of the section this plug-in renders on the organizer's
 *    dashboard. The tile above that section is a jump link with a label and an
 *    icon and no number — a number there would mean the host asking a plug-in a
 *    question, which is the one direction the contract does not have.
 */
@Injectable()
export class ProgramProposalsService {
  constructor(
    @Inject(PROPOSAL_REPOSITORY)
    private readonly proposals: ProposalRepository,
    // The host's participant port (E58). The only way this plug-in learns that
    // accounts exist, and deliberately the narrowest one: a name and a picture,
    // never an address (F55).
    @Inject(PLUGIN_PARTICIPANT_READS)
    private readonly participants: PluginParticipantReads,
  ) {}

  /**
   * What one participant sees of one event's proposals (E51, E58).
   *
   * Approved ones of everyone plus all of their own, whatever the status. The
   * filter is in the repository's statement rather than here, so no future
   * caller of this service can widen it.
   */
  async listForParticipant(
    eventId: string,
    viewerId: string,
    query: ProposalQuery,
  ): Promise<ProposalPage> {
    const window = this.window(query);
    const slice = await this.proposals.findForParticipant(
      eventId,
      viewerId,
      rows(window),
    );
    return this.page(slice, window);
  }

  /** The organizer's moderation list for one event, optionally by status. */
  async listForEvent(
    eventId: string,
    query: ProposalQuery,
  ): Promise<ProposalPage> {
    const window = this.window(query);
    const slice = await this.proposals.findForEvent(
      eventId,
      query.status,
      rows(window),
    );
    return this.page(slice, window);
  }

  /**
   * How many of one event's proposals are in each state (E59).
   *
   * For the heading of the section the plug-in draws on the organizer's
   * dashboard. Its own route rather than a field on the moderation list,
   * because the list is narrowed to the queue there and a narrowed list can
   * only count itself — and because the number belongs to the section, not to
   * whichever page of the list happens to be open.
   *
   * A state the event has no rows in is a zero rather than a missing key: SQL
   * groups what is there, and a heading that showed nothing where it should
   * show "0 rejected" would read as a broken heading.
   */
  async summarize(eventId: string): Promise<ProposalSummary> {
    const counts = await this.proposals.countByStatus(eventId);
    return {
      pending: counts.get('pending') ?? 0,
      approved: counts.get('approved') ?? 0,
      rejected: counts.get('rejected') ?? 0,
    };
  }

  /**
   * Submits a proposal, which starts out pending (FR 3.13).
   *
   * Whether the event is published, or over, is deliberately not checked: the
   * plug-in cannot read an event's state — the contract publishes no port for
   * it — and inventing a rule here would be a product decision taken in a
   * plug-in. What the database does enforce is that the event and the account
   * exist, and an absent one is a 404 rather than a failed constraint.
   *
   * @throws BadRequestException — a title or a description that is only
   * whitespace. The DTO bounds the lengths; what it cannot see is that `"   "`
   * has a length. The table refuses it too (`CHK_plugin_program_proposals_*`),
   * and a constraint violation is not a sentence.
   * @throws NotFoundException — no such event.
   */
  async submit(
    eventId: string,
    authorId: string,
    input: NewProgramProposal,
  ): Promise<ProgramProposal> {
    const title = input.title.trim();
    const description = input.description.trim();
    if (title.length === 0) {
      throw new BadRequestException('A proposal needs a title.');
    }
    if (description.length === 0) {
      throw new BadRequestException(
        'Say what the session would be about. A proposal is an argument.',
      );
    }

    try {
      const created = await this.proposals.create({
        eventId,
        authorId,
        title,
        description,
      });
      return await this.withAuthor(created);
    } catch (error: unknown) {
      if (!(error instanceof UnknownProposalTargetError)) throw error;
      throw new NotFoundException(
        `No event with id ${eventId}. A proposal belongs to one event.`,
      );
    }
  }

  /** Publishes a proposal to everyone reading this event's list (E51). */
  approve(proposalId: string, organizerId: string): Promise<ProgramProposal> {
    return this.decide(proposalId, 'approved', organizerId);
  }

  /** Refuses one, and the row stays where it was (E14, FR 3.14). */
  reject(proposalId: string, organizerId: string): Promise<ProgramProposal> {
    return this.decide(proposalId, 'rejected', organizerId);
  }

  private async decide(
    proposalId: string,
    status: Exclude<ProposalStatus, 'pending'>,
    organizerId: string,
  ): Promise<ProgramProposal> {
    const decided = await this.proposals.decide(
      proposalId,
      status,
      new Date(),
      organizerId,
    );
    if (!decided) {
      throw new NotFoundException(`No proposal with id ${proposalId}`);
    }
    return this.withAuthor(decided);
  }

  /**
   * What a client may ask for, capped at what this endpoint will answer.
   *
   * The host's own function, reached through the contract rather than copied
   * into the plug-in (F138): a second reading of "page 0" is exactly the drift
   * that put it in one place.
   */
  private window(query: ProposalQuery): PageWindow {
    return pageWindow(
      query,
      DEFAULT_PROPOSAL_PAGE_SIZE,
      MAX_PROPOSAL_PAGE_SIZE,
    );
  }

  private async page(
    slice: { rows: readonly ProposalRecord[]; total: number },
    window: PageWindow,
  ): Promise<ProposalPage> {
    const authors = await this.participants.findAuthors(
      slice.rows.map((row) => row.authorId),
    );
    return {
      rows: slice.rows.map((row) => toProposal(row, authors.get(row.authorId))),
      total: slice.total,
      page: window.page,
      pageSize: window.pageSize,
    };
  }

  private async withAuthor(row: ProposalRecord): Promise<ProgramProposal> {
    const authors = await this.participants.findAuthors([row.authorId]);
    return toProposal(row, authors.get(row.authorId));
  }
}

/**
 * The window in the terms a statement uses.
 *
 * `PageWindow` carries the page number as well, because the answer reports what
 * was actually read; SQL needs two of its three fields, and a repository that
 * took the page number too would invite a second place to multiply it out.
 */
function rows(window: PageWindow): { offset: number; limit: number } {
  return { offset: window.offset, limit: window.pageSize };
}

function toProposal(
  row: ProposalRecord,
  author: PluginAuthor | undefined,
): ProgramProposal {
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.title,
    description: row.description,
    status: row.status,
    // Absent rather than invented: an id with no confirmed account behind it is
    // a row whose owner closed it, and a placeholder name would be a person.
    author: author ?? null,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}
