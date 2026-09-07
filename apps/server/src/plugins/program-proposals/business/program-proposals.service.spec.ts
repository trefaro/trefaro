import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ProposalStatus } from '@trefaro/shared-models';
import type {
  PluginAuthor,
  PluginParticipantReads,
} from '../../../app/business/plugin-api';
import {
  UnknownProposalTargetError,
  type CreateProposalInput,
  type ProposalRecord,
  type ProposalRepository,
  type ProposalSlice,
  type ProposalWindow,
} from './ports/proposal.repository';
import { ProgramProposalsService } from './program-proposals.service';

/**
 * Programme proposals (FR 3.13, FR 3.14) — AP 2 of phase 4.
 *
 * The visibility rule of E51 is deliberately **not** asserted here: it lives in
 * the repository's SQL (F152), so a fake repository could only prove that the
 * fake filters. It is decided against the real database in
 * `apps/server-e2e/src/api/plugin-program-proposals.spec.ts`.
 *
 * What this level can decide is everything the service itself is responsible
 * for: which window a list reads, that a decision carries a time and an
 * organizer, that names are resolved once for a whole page, and that an
 * unresolvable author leaves a row without one rather than with a placeholder.
 */
class FakeProposalRepository implements ProposalRepository {
  readonly rows: ProposalRecord[] = [];
  readonly participantCalls: {
    viewerId: string;
    window: ProposalWindow;
  }[] = [];
  readonly eventCalls: {
    status: ProposalStatus | undefined;
    window: ProposalWindow;
  }[] = [];
  readonly decisions: {
    id: string;
    status: string;
    decidedBy: string;
    decidedAt: Date;
  }[] = [];
  /** Set to make `create` fail the way a missing event does. */
  unknownTarget = false;

  async findForParticipant(
    _eventId: string,
    viewerId: string,
    window: ProposalWindow,
  ): Promise<ProposalSlice> {
    this.participantCalls.push({ viewerId, window });
    return { rows: this.rows, total: this.rows.length };
  }

  async findForEvent(
    _eventId: string,
    status: ProposalStatus | undefined,
    window: ProposalWindow,
  ): Promise<ProposalSlice> {
    this.eventCalls.push({ status, window });
    return { rows: this.rows, total: 42 };
  }

  async findById(id: string): Promise<ProposalRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async countByStatus(
    _eventId: string,
  ): Promise<ReadonlyMap<ProposalStatus, number>> {
    // Only what the event has rows in, the way `GROUP BY` answers.
    const counts = new Map<ProposalStatus, number>();
    for (const row of this.rows) {
      counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
    }
    return counts;
  }

  async create(input: CreateProposalInput): Promise<ProposalRecord> {
    if (this.unknownTarget) {
      throw new UnknownProposalTargetError(input.eventId);
    }
    const created = proposal({ ...input, id: 'created' });
    this.rows.push(created);
    return created;
  }

  async decide(
    id: string,
    status: Exclude<ProposalStatus, 'pending'>,
    decidedAt: Date,
    decidedBy: string,
  ): Promise<ProposalRecord | null> {
    const row = this.rows.find((one) => one.id === id);
    if (!row) return null;
    this.decisions.push({ id, status, decidedAt, decidedBy });
    return { ...row, status, decidedAt, decidedBy };
  }
}

function proposal(over: Partial<ProposalRecord> = {}): ProposalRecord {
  return {
    id: 'proposal-1',
    eventId: 'event-1',
    authorId: 'author-1',
    title: 'A workshop on election observation',
    description: 'Half a day, hands on.',
    status: 'pending',
    decidedAt: null,
    decidedBy: null,
    createdAt: new Date('2026-09-07T09:00:00.000Z'),
    ...over,
  };
}

interface Harness {
  service: ProgramProposalsService;
  repository: FakeProposalRepository;
  asked: string[][];
}

function harness(known: readonly string[] = ['author-1']): Harness {
  const repository = new FakeProposalRepository();
  const asked: string[][] = [];
  const participants: PluginParticipantReads = {
    findAuthors: (ids) => {
      asked.push([...ids]);
      const found = new Map<string, PluginAuthor>();
      for (const id of ids) {
        if (!known.includes(id)) continue;
        found.set(id, { id, name: 'Amina Okonkwo', avatarUrl: null });
      }
      return Promise.resolve(found);
    },
  };

  return {
    service: new ProgramProposalsService(repository, participants),
    repository,
    asked,
  };
}

describe('ProgramProposalsService', () => {
  describe('proposing something', () => {
    it('trims what was typed and starts out pending', async () => {
      const { service, repository } = harness();

      const created = await service.submit('event-1', 'author-1', {
        title: '  A workshop on election observation  ',
        description: '  Half a day, hands on.\n',
      });

      expect(repository.rows[0]).toMatchObject({
        title: 'A workshop on election observation',
        description: 'Half a day, hands on.',
        status: 'pending',
      });
      // Pending is the answer as well, so the client can show the status
      // without a second request (FR 3.14).
      expect(created.status).toBe('pending');
      expect(created.decidedAt).toBeNull();
    });

    it('refuses a title or a description that is only whitespace', async () => {
      const { service, repository } = harness();

      // `Length(1, …)` cannot see that `"   "` has a length. The table refuses
      // it as well, and a check-constraint violation is not a sentence.
      await expect(
        service.submit('event-1', 'author-1', {
          title: '   ',
          description: 'D',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.submit('event-1', 'author-1', {
          title: 'T',
          description: '\n\t ',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.rows).toEqual([]);
    });

    it('answers 404 for an event the database does not know', async () => {
      const { service, repository } = harness();
      repository.unknownTarget = true;

      // A 404 rather than the constraint violation underneath it: the event was
      // deleted between the page load and the submission.
      await expect(
        service.submit('gone', 'author-1', { title: 'T', description: 'D' }),
      ).rejects.toThrow(NotFoundException);
    });

    it("carries the author's name back, resolved through the host port", async () => {
      const { service, asked } = harness();

      const created = await service.submit('event-1', 'author-1', {
        title: 'T',
        description: 'D',
      });

      expect(created.author).toEqual({
        id: 'author-1',
        name: 'Amina Okonkwo',
        avatarUrl: null,
      });
      expect(asked).toEqual([['author-1']]);
    });
  });

  describe('reading a list', () => {
    it('passes the reader on, so the rule can be applied where it belongs', async () => {
      const { service, repository } = harness();

      await service.listForParticipant('event-1', 'viewer-9', {});

      // The service does not filter: E51 is in the statement (F152), and what
      // this level owes it is the id of whoever is asking.
      expect(repository.participantCalls[0].viewerId).toBe('viewer-9');
    });

    it('falls back to the default window and caps what a client asks for', async () => {
      const { service, repository } = harness();

      await service.listForParticipant('event-1', 'viewer-9', {
        page: 0,
        pageSize: 5000,
      });
      await service.listForEvent('event-1', { page: 3, pageSize: 10 });

      // Page 0 is not a smaller request, it is no request — so it gets the
      // default rather than the nearest legal value (F159).
      expect(repository.participantCalls[0].window).toEqual({
        offset: 0,
        limit: 100,
      });
      expect(repository.eventCalls[0].window).toEqual({
        offset: 20,
        limit: 10,
      });
    });

    it('reports the page it actually read and the total it divides', async () => {
      const { service } = harness();

      const page = await service.listForEvent('event-1', { page: 2 });

      expect(page).toMatchObject({ page: 2, pageSize: 20, total: 42 });
    });

    it('narrows the moderation list by status when asked, and not otherwise', async () => {
      const { service, repository } = harness();

      await service.listForEvent('event-1', { status: 'pending' });
      await service.listForEvent('event-1', {});

      expect(repository.eventCalls.map((call) => call.status)).toEqual([
        'pending',
        undefined,
      ]);
    });

    it('asks for every name of a page in one call (F49)', async () => {
      const { service, repository, asked } = harness();
      repository.rows.push(
        proposal({ id: 'a', authorId: 'author-1' }),
        proposal({ id: 'b', authorId: 'author-2' }),
        proposal({ id: 'c', authorId: 'author-1' }),
      );

      await service.listForEvent('event-1', {});

      expect(asked).toEqual([['author-1', 'author-2', 'author-1']]);
    });

    it('leaves a row without an author rather than inventing one', async () => {
      const { service, repository } = harness(['author-1']);
      repository.rows.push(
        proposal({ id: 'a', authorId: 'author-1' }),
        proposal({ id: 'b', authorId: 'closed-account' }),
      );

      const page = await service.listForEvent('event-1', {});

      expect(page.rows.map((row) => row.author?.name ?? null)).toEqual([
        'Amina Okonkwo',
        null,
      ]);
    });
  });

  describe('deciding (E51)', () => {
    it('records the status, the moment and the organizer together', async () => {
      const { service, repository } = harness();
      repository.rows.push(proposal({ id: 'proposal-1' }));

      const approved = await service.approve('proposal-1', 'organizer-3');

      expect(repository.decisions[0]).toMatchObject({
        id: 'proposal-1',
        status: 'approved',
        decidedBy: 'organizer-3',
      });
      expect(approved.status).toBe('approved');
      // A decision has a moment — the table's check constraint refuses any
      // other combination.
      expect(approved.decidedAt).not.toBeNull();
    });

    it('keeps a rejected proposal, with its status on it (E14, FR 3.14)', async () => {
      const { service, repository } = harness();
      repository.rows.push(proposal({ id: 'proposal-1' }));

      const rejected = await service.reject('proposal-1', 'organizer-3');

      expect(rejected).toMatchObject({
        id: 'proposal-1',
        status: 'rejected',
        title: 'A workshop on election observation',
      });
      // Nothing was removed: a refusal that deleted the row would be
      // indistinguishable from a submission that never arrived.
      expect(repository.rows).toHaveLength(1);
    });

    it('answers 404 for a proposal that is gone', async () => {
      const { service } = harness();

      await expect(service.approve('nothing', 'organizer-3')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('the count for the dashboard section (E59)', () => {
    it('counts each state of one event', async () => {
      const { service, repository } = harness();
      repository.rows.push(
        proposal({ id: 'a', status: 'pending' }),
        proposal({ id: 'b', status: 'pending' }),
        proposal({ id: 'c', status: 'approved' }),
        proposal({ id: 'd', status: 'rejected' }),
      );

      await expect(service.summarize('event-1')).resolves.toEqual({
        pending: 2,
        approved: 1,
        rejected: 1,
      });
    });

    it('says zero for a state with no rows, rather than leaving it out', async () => {
      const { service, repository } = harness();
      repository.rows.push(proposal({ id: 'a', status: 'pending' }));

      // `GROUP BY` answers with what is there; a heading needs all three, and
      // a missing number would read as a broken heading.
      await expect(service.summarize('event-1')).resolves.toEqual({
        pending: 1,
        approved: 0,
        rejected: 0,
      });
    });

    it('asks for no names — a count has no authors', async () => {
      const { service, repository, asked } = harness();
      repository.rows.push(proposal({ id: 'a' }));

      await service.summarize('event-1');

      // The host port is the expensive part of a page (F49); a heading of
      // three numbers must not pay for it.
      expect(asked).toEqual([]);
    });
  });
});
