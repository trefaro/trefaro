import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ForumPostStatus } from '@trefaro/shared-models';
import type {
  PluginAuthor,
  PluginParticipantReads,
} from '../../../app/business/plugin-api';
import {
  UnknownForumEventError,
  type AddPostInput,
  type ForumRepository,
  type ForumSlice,
  type ForumWindow,
  type ModeratedPostRecord,
  type OpenThreadInput,
  type PostRecord,
  type ThreadPosts,
  type ThreadRecord,
} from './ports/forum.repository';
import { ForumService } from './forum.service';

/**
 * The discussion forum (FR 4.6) — AP 4 of phase 4.
 *
 * The visibility rules of E51 and F195 are deliberately **not** asserted here:
 * they live in the repository's SQL (F152), so a fake repository could only
 * prove that the fake filters. They are decided against the real database in
 * `apps/server-e2e/src/api/plugin-forum.spec.ts`.
 *
 * What this level can decide is everything the service itself is responsible
 * for: that a post made of whitespace is refused before anything is written,
 * that "not visible" and "not there" become the same 404, which window a list
 * reads, that a decision carries a time and an organizer, and that names are
 * resolved once for a whole page — and only for the accounts that exist.
 */
class FakeForumRepository implements ForumRepository {
  readonly threads: ThreadRecord[] = [];
  readonly posts: PostRecord[] = [];
  readonly threadCalls: { viewerId: string; window: ForumWindow }[] = [];
  readonly postCalls: {
    threadId: string;
    viewerId: string;
    window: ForumWindow;
  }[] = [];
  readonly eventCalls: {
    status: ForumPostStatus | undefined;
    window: ForumWindow;
  }[] = [];
  readonly decisions: {
    id: string;
    status: string;
    decidedBy: string;
    decidedAt: Date;
  }[] = [];
  /** Set to make `openThread` fail the way a missing event does. */
  unknownEvent = false;
  /** Threads the fake treats as visible to whoever asks. */
  readonly visible = new Set<string>();

  async findThreadsForParticipant(
    _eventId: string,
    viewerId: string,
    window: ForumWindow,
  ): Promise<ForumSlice<ThreadRecord>> {
    this.threadCalls.push({ viewerId, window });
    return { rows: this.threads, total: 42 };
  }

  async openThread(
    input: OpenThreadInput,
  ): Promise<{ thread: ThreadRecord; post: PostRecord }> {
    if (this.unknownEvent) throw new UnknownForumEventError(input.eventId);
    const opened = thread({
      id: 'opened',
      eventId: input.eventId,
      title: input.title,
      createdBy: input.authorId,
    });
    const first = post({
      id: 'first',
      threadId: opened.id,
      authorId: input.authorId,
      body: input.body,
    });
    this.threads.push(opened);
    this.posts.push(first);
    return { thread: opened, post: first };
  }

  async findPostsForParticipant(
    threadId: string,
    viewerId: string,
    window: ForumWindow,
  ): Promise<ThreadPosts | null> {
    this.postCalls.push({ threadId, viewerId, window });
    const found = this.threads.find((row) => row.id === threadId);
    if (!found || !this.visible.has(threadId)) return null;
    const rows = this.posts.filter((row) => row.threadId === threadId);
    return { thread: found, rows, total: rows.length };
  }

  async addPost(input: AddPostInput): Promise<PostRecord | null> {
    if (!this.visible.has(input.threadId)) return null;
    const created = post({ ...input, id: 'reply' });
    this.posts.push(created);
    return created;
  }

  async findPostsForEvent(
    _eventId: string,
    status: ForumPostStatus | undefined,
    window: ForumWindow,
  ): Promise<ForumSlice<ModeratedPostRecord>> {
    this.eventCalls.push({ status, window });
    return {
      rows: this.posts.map((row) => ({ ...row, threadTitle: 'Where to meet' })),
      total: 7,
    };
  }

  async countPostsByStatus(
    _eventId: string,
  ): Promise<ReadonlyMap<ForumPostStatus, number>> {
    // Like `GROUP BY`: only the states that have rows appear.
    const counts = new Map<ForumPostStatus, number>();
    for (const row of this.posts) {
      counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
    }
    return counts;
  }

  async decide(
    postId: string,
    status: Exclude<ForumPostStatus, 'pending'>,
    decidedAt: Date,
    decidedBy: string,
  ): Promise<ModeratedPostRecord | null> {
    const row = this.posts.find((one) => one.id === postId);
    if (!row) return null;
    this.decisions.push({ id: postId, status, decidedAt, decidedBy });
    return {
      ...row,
      status,
      decidedAt,
      decidedBy,
      threadTitle: 'Where to meet',
    };
  }
}

function thread(over: Partial<ThreadRecord> = {}): ThreadRecord {
  return {
    id: 'thread-1',
    eventId: 'event-1',
    title: 'Where to meet',
    createdBy: 'author-1',
    createdAt: new Date('2026-09-08T09:00:00.000Z'),
    lastPostAt: new Date('2026-09-08T09:00:00.000Z'),
    ...over,
  };
}

function post(over: Partial<PostRecord> = {}): PostRecord {
  return {
    id: 'post-1',
    threadId: 'thread-1',
    authorId: 'author-1',
    body: 'In front of the main entrance?',
    status: 'pending',
    decidedAt: null,
    decidedBy: null,
    createdAt: new Date('2026-09-08T09:00:00.000Z'),
    ...over,
  };
}

interface Harness {
  service: ForumService;
  repository: FakeForumRepository;
  asked: string[][];
}

function harness(known: readonly string[] = ['author-1']): Harness {
  const repository = new FakeForumRepository();
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
    service: new ForumService(repository, participants),
    repository,
    asked,
  };
}

describe('ForumService', () => {
  describe('opening a thread', () => {
    it('trims title and body, and the first post starts out pending', async () => {
      const { service, repository } = harness();

      const opened = await service.openThread('event-1', 'author-1', {
        title: '  Where to meet  ',
        body: '  In front of the main entrance?\n',
      });

      expect(repository.threads[0]).toMatchObject({ title: 'Where to meet' });
      expect(repository.posts[0]).toMatchObject({
        body: 'In front of the main entrance?',
        status: 'pending',
      });
      // Both come back, so the screen after "open" needs no second request
      // (F49) — and the status is on the post, never on the thread (F195).
      expect(opened.thread.title).toBe('Where to meet');
      expect(opened.post.status).toBe('pending');
      expect(opened.post.decidedAt).toBeNull();
    });

    it('refuses a title or a body that is only whitespace, and writes nothing', async () => {
      const { service, repository } = harness();

      // `Length(1, …)` cannot see that `"   "` has a length. The table refuses
      // it as well, and a check-constraint violation is not a sentence.
      await expect(
        service.openThread('event-1', 'author-1', {
          title: '   ',
          body: 'B',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.openThread('event-1', 'author-1', {
          title: 'T',
          body: '\n\t ',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.threads).toEqual([]);
      expect(repository.posts).toEqual([]);
    });

    it('answers 404 for an event the database does not know', async () => {
      const { service, repository } = harness();
      repository.unknownEvent = true;

      await expect(
        service.openThread('gone', 'author-1', { title: 'T', body: 'B' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('names the author on thread and post alike, asking the host once', async () => {
      const { service, asked } = harness();

      const opened = await service.openThread('event-1', 'author-1', {
        title: 'T',
        body: 'B',
      });

      const author = { id: 'author-1', name: 'Amina Okonkwo', avatarUrl: null };
      expect(opened.thread.author).toEqual(author);
      expect(opened.post.author).toEqual(author);
      // One person, one question — not one per object that names them.
      expect(asked).toEqual([['author-1']]);
    });
  });

  describe('reading the threads of an event', () => {
    it('passes the reader on, so the rule can be applied where it belongs', async () => {
      const { service, repository } = harness();

      await service.listThreads('event-1', 'viewer-9', {});

      // The service does not filter: E51 and F195 are in the statement (F152),
      // and what this level owes it is the id of whoever is asking.
      expect(repository.threadCalls[0].viewerId).toBe('viewer-9');
    });

    it('falls back to the default window and caps what a client asks for', async () => {
      const { service, repository } = harness();

      await service.listThreads('event-1', 'viewer-9', {
        page: 0,
        pageSize: 5000,
      });
      await service.listThreads('event-1', 'viewer-9', {
        page: 3,
        pageSize: 10,
      });

      // Page 0 is not a smaller request, it is no request — so it gets the
      // default rather than the nearest legal value (F159).
      expect(repository.threadCalls[0].window).toEqual({
        offset: 0,
        limit: 100,
      });
      expect(repository.threadCalls[1].window).toEqual({
        offset: 20,
        limit: 10,
      });
    });

    it('reports the page it actually read and the total it divides', async () => {
      const { service } = harness();

      const page = await service.listThreads('event-1', 'viewer-9', {
        page: 2,
      });

      expect(page).toMatchObject({ page: 2, pageSize: 20, total: 42 });
    });

    it('asks for every name of a page in one call (F49)', async () => {
      const { service, repository, asked } = harness();
      repository.threads.push(
        thread({ id: 'a', createdBy: 'author-1' }),
        thread({ id: 'b', createdBy: 'author-2' }),
        thread({ id: 'c', createdBy: 'author-1' }),
      );

      await service.listThreads('event-1', 'viewer-9', {});

      expect(asked).toEqual([['author-1', 'author-2', 'author-1']]);
    });

    it('leaves a thread without an author rather than inventing one', async () => {
      const { service, repository } = harness(['author-1']);
      repository.threads.push(
        thread({ id: 'a', createdBy: 'author-1' }),
        thread({ id: 'b', createdBy: 'closed-account' }),
      );

      const page = await service.listThreads('event-1', 'viewer-9', {});

      expect(page.rows.map((row) => row.author?.name ?? null)).toEqual([
        'Amina Okonkwo',
        null,
      ]);
      expect(page.rows[0]).toMatchObject({
        id: 'a',
        eventId: 'event-1',
        title: 'Where to meet',
        createdAt: '2026-09-08T09:00:00.000Z',
        lastPostAt: '2026-09-08T09:00:00.000Z',
      });
    });
  });

  describe('reading one thread', () => {
    it('answers 404 for a thread that is not there or not visible', async () => {
      const { service, repository } = harness();
      repository.threads.push(thread({ id: 'hidden' }));
      // In the table, but the fake says "not visible to you" — and the service
      // must not be able to tell the two apart.

      await expect(service.listPosts('hidden', 'viewer-9', {})).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        service.listPosts('nothing', 'viewer-9', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('brings the thread with its posts, names resolved in one call', async () => {
      const { service, repository, asked } = harness(['author-1', 'author-2']);
      repository.threads.push(
        thread({ id: 'thread-1', createdBy: 'author-1' }),
      );
      repository.visible.add('thread-1');
      repository.posts.push(
        post({ id: 'a', authorId: 'author-1' }),
        post({ id: 'b', authorId: 'author-2', status: 'approved' }),
      );

      const page = await service.listPosts('thread-1', 'viewer-9', {
        pageSize: 10,
      });

      expect(page.thread).toMatchObject({
        id: 'thread-1',
        author: { name: 'Amina Okonkwo' },
      });
      expect(page.rows.map((row) => row.id)).toEqual(['a', 'b']);
      expect(page).toMatchObject({ total: 2, page: 1, pageSize: 10 });
      // The thread's author and the posts' authors in one question.
      expect(asked).toEqual([['author-1', 'author-1', 'author-2']]);
      expect(repository.postCalls[0]).toMatchObject({
        viewerId: 'viewer-9',
        window: { offset: 0, limit: 10 },
      });
    });
  });

  describe('replying', () => {
    it('trims the body and starts out pending', async () => {
      const { service, repository } = harness();
      repository.visible.add('thread-1');

      const reply = await service.reply('thread-1', 'author-1', {
        body: '  Sounds good.  ',
      });

      expect(repository.posts[0]).toMatchObject({
        threadId: 'thread-1',
        body: 'Sounds good.',
        status: 'pending',
      });
      expect(reply.status).toBe('pending');
      expect(reply.author).toMatchObject({ name: 'Amina Okonkwo' });
    });

    it('refuses a body made of whitespace before asking the repository', async () => {
      const { service, repository } = harness();
      repository.visible.add('thread-1');

      await expect(
        service.reply('thread-1', 'author-1', { body: '   ' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.posts).toEqual([]);
    });

    it('answers 404 for a thread the author cannot see', async () => {
      const { service } = harness();

      // One cannot write into a conversation one cannot read — and the answer
      // is the one an unknown id gets, so a guessed id learns nothing.
      await expect(
        service.reply('elsewhere', 'author-1', { body: 'Hello?' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('the moderation list', () => {
    it('narrows by status when asked, and not otherwise', async () => {
      const { service, repository } = harness();

      await service.moderationList('event-1', { status: 'pending' });
      await service.moderationList('event-1', {});

      expect(repository.eventCalls.map((call) => call.status)).toEqual([
        'pending',
        undefined,
      ]);
    });

    it('shows each post in the context of its thread', async () => {
      const { service, repository } = harness();
      repository.posts.push(post({ id: 'a' }));

      const page = await service.moderationList('event-1', {});

      expect(page.rows[0]).toMatchObject({
        id: 'a',
        thread: { id: 'thread-1', title: 'Where to meet' },
        author: { name: 'Amina Okonkwo' },
      });
      expect(page).toMatchObject({ total: 7, page: 1, pageSize: 20 });
    });
  });

  describe('deciding (E51)', () => {
    it('records the status, the moment and the organizer together', async () => {
      const { service, repository } = harness();
      repository.posts.push(post({ id: 'post-1' }));

      const approved = await service.approve('post-1', 'organizer-3');

      expect(repository.decisions[0]).toMatchObject({
        id: 'post-1',
        status: 'approved',
        decidedBy: 'organizer-3',
      });
      expect(approved.status).toBe('approved');
      // A decision has a moment — the table's check constraint refuses any
      // other combination.
      expect(approved.decidedAt).not.toBeNull();
      expect(approved.thread).toEqual({
        id: 'thread-1',
        title: 'Where to meet',
      });
    });

    it('keeps a rejected post, with its status on it (E14, FR 4.6)', async () => {
      const { service, repository } = harness();
      repository.posts.push(post({ id: 'post-1' }));

      const rejected = await service.reject('post-1', 'organizer-3');

      expect(rejected).toMatchObject({
        id: 'post-1',
        status: 'rejected',
        body: 'In front of the main entrance?',
      });
      // Nothing was removed: a refusal that deleted the row would be
      // indistinguishable from a post that never arrived.
      expect(repository.posts).toHaveLength(1);
    });

    it('answers 404 for a post that is gone', async () => {
      const { service } = harness();

      await expect(service.approve('nothing', 'organizer-3')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('the counts above the queue (E59)', () => {
    it('counts the posts of one event by state, in one question', async () => {
      const { service, repository } = harness();
      repository.posts.push(
        post({ id: 'a', status: 'pending' }),
        post({ id: 'b', status: 'pending' }),
        post({ id: 'c', status: 'approved' }),
        post({ id: 'd', status: 'rejected' }),
      );

      await expect(service.summarize('event-1')).resolves.toEqual({
        pending: 2,
        approved: 1,
        rejected: 1,
      });
    });

    it('says zero for a state with no rows, rather than leaving it out', async () => {
      const { service, repository } = harness();
      repository.posts.push(post({ id: 'a', status: 'pending' }));

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
      repository.posts.push(post({ id: 'a' }));

      await service.summarize('event-1');

      // The host port is the expensive part of a page (F49); a heading of
      // three numbers must not pay for it.
      expect(asked).toEqual([]);
    });
  });
});
