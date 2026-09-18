import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_FORUM_PAGE_SIZE,
  MAX_FORUM_PAGE_SIZE,
  type ForumModerationPage,
  type ForumModerationQuery,
  type ForumPageQuery,
  type ForumPost,
  type ForumPostPage,
  type ForumPostStatus,
  type ForumSummary,
  type ForumThread,
  type ForumThreadPage,
  type ModeratedForumPost,
  type NewForumPost,
  type NewForumThread,
  type OpenedForumThread,
} from '@trefaro/shared-models';
import {
  PLUGIN_PARTICIPANT_READS,
  pageWindow,
  type PageWindow,
  type PluginAuthor,
  type PluginParticipantReads,
} from '../../../app/business/plugin-api';
import {
  FORUM_REPOSITORY,
  UnknownForumEventError,
  type ForumRepository,
  type ModeratedPostRecord,
  type PostRecord,
  type ThreadRecord,
} from './ports/forum.repository';

/**
 * The discussion forum (FR 4.6): one forum per event, threads with posts, and
 * a decision per post.
 *
 * The second plug-in built against the extended contract, and the test the plan
 * set for AP 2: it uses the same two things of the host — who is asking, and
 * what an author is called — through the same port, without that port having
 * been touched. This file contains no ORM import, no core entity and no
 * knowledge of `user_profile`.
 *
 * Four decisions worth naming:
 *
 * 1. **A post is pending until somebody decides** (E51), and a decision is a
 *    route rather than a field: `POST …/approval` and `POST …/rejection`. Three
 *    states, one instant, one organizer, no thread on the decision. The survey
 *    asked in as many words for the moderation effort to stay minimal, and UC
 *    15 describes exactly this: a post is created but not published.
 * 2. **A thread has no status of its own** (F195). It is visible as soon as a
 *    post in it is approved — and to the person who wrote in it, whatever the
 *    status of what they wrote. A status column on the thread would have been a
 *    second moderation surface for the same decision.
 * 3. **A rejected post stays** (E14) and shows its status to the person who
 *    wrote it, and to nobody else but the organization. Deleting it would make a
 *    refusal indistinguishable from a post that never arrived.
 * 4. **"Not visible" and "not there" are one answer.** A thread nobody has
 *    published anything in exists for its author and the organization only;
 *    everybody else gets the 404 an unknown id gets, whether they try to read
 *    it or to reply into it. The rule is in the repository's statements (F152),
 *    and what this level owes it is the id of whoever is asking.
 *
 * Names are resolved once per page (F49): one call to the host port for the
 * whole list — thread author and post authors together — and an id it cannot
 * resolve leaves a row without an author rather than with a placeholder.
 */
@Injectable()
export class ForumService {
  constructor(
    @Inject(FORUM_REPOSITORY)
    private readonly forum: ForumRepository,
    // The host's participant port (E58). The only way this plug-in learns that
    // accounts exist, and deliberately the narrowest one: a name and a picture,
    // never an address (F55).
    @Inject(PLUGIN_PARTICIPANT_READS)
    private readonly participants: PluginParticipantReads,
  ) {}

  /**
   * The threads of one event a participant may see (E51, F195).
   *
   * Every thread with a published post plus every thread the reader wrote in,
   * latest published activity first. The filter is in the repository's
   * statement rather than here, so no future caller of this service can widen
   * it.
   */
  async listThreads(
    eventId: string,
    viewerId: string,
    query: ForumPageQuery,
  ): Promise<ForumThreadPage> {
    const window = this.window(query);
    const slice = await this.forum.findThreadsForParticipant(
      eventId,
      viewerId,
      rows(window),
    );
    const authors = await this.authorsOf(
      slice.rows.map((row) => row.createdBy).filter(isId),
    );
    return {
      rows: slice.rows.map((row) => toThread(row, authors)),
      total: slice.total,
      page: window.page,
      pageSize: window.pageSize,
    };
  }

  /**
   * Opens a thread with its first post (FR 4.6).
   *
   * The post starts out pending, so the thread is visible to its author and to
   * the organization only until somebody decides (F195). Whether the event is
   * published, or over, is deliberately not checked: the plug-in cannot read an
   * event's state — the contract publishes no port for it — and inventing a
   * rule here would be a product decision taken in a plug-in. What the database
   * does enforce is that the event exists, and an absent one is a 404 rather
   * than a failed constraint.
   *
   * @throws BadRequestException — a title or a body that is only whitespace.
   * The DTO bounds the lengths; what it cannot see is that `"   "` has a
   * length. The table refuses it too, and a constraint violation is not a
   * sentence.
   * @throws NotFoundException — no such event.
   */
  async openThread(
    eventId: string,
    authorId: string,
    input: NewForumThread,
  ): Promise<OpenedForumThread> {
    const title = input.title.trim();
    const body = requireBody(input.body);
    if (title.length === 0) {
      throw new BadRequestException('A thread needs a title.');
    }

    try {
      const opened = await this.forum.openThread({
        eventId,
        authorId,
        title,
        body,
      });
      const authors = await this.authorsOf([authorId]);
      return {
        thread: toThread(opened.thread, authors),
        post: toPost(opened.post, authors),
      };
    } catch (error: unknown) {
      if (!(error instanceof UnknownForumEventError)) throw error;
      throw new NotFoundException(
        `No event with id ${eventId}. A thread belongs to one event.`,
      );
    }
  }

  /**
   * One thread as a participant may read it: the thread, and its approved
   * posts plus their own, oldest first.
   *
   * @throws NotFoundException — no such thread, or none this reader may see;
   * the two are one answer on purpose.
   */
  async listPosts(
    threadId: string,
    viewerId: string,
    query: ForumPageQuery,
  ): Promise<ForumPostPage> {
    const window = this.window(query);
    const found = await this.forum.findPostsForParticipant(
      threadId,
      viewerId,
      rows(window),
    );
    if (!found) throw unknownThread(threadId);

    const authors = await this.authorsOf([
      ...[found.thread.createdBy].filter(isId),
      ...found.rows.map((row) => row.authorId),
    ]);
    return {
      thread: toThread(found.thread, authors),
      rows: found.rows.map((row) => toPost(row, authors)),
      total: found.total,
      page: window.page,
      pageSize: window.pageSize,
    };
  }

  /**
   * Replies to a thread; the reply starts out pending.
   *
   * @throws BadRequestException — a body that is only whitespace.
   * @throws NotFoundException — no such thread, or none this author may see:
   * one cannot write into a conversation one cannot read.
   */
  async reply(
    threadId: string,
    authorId: string,
    input: NewForumPost,
  ): Promise<ForumPost> {
    const body = requireBody(input.body);

    const created = await this.forum.addPost({ threadId, authorId, body });
    if (!created) throw unknownThread(threadId);

    return toPost(created, await this.authorsOf([authorId]));
  }

  /**
   * The organizer's moderation list for one event, optionally by status —
   * each post with the thread it is in (AP 5 draws it in that context).
   */
  async moderationList(
    eventId: string,
    query: ForumModerationQuery,
  ): Promise<ForumModerationPage> {
    const window = this.window(query);
    const slice = await this.forum.findPostsForEvent(
      eventId,
      query.status,
      rows(window),
    );
    const authors = await this.authorsOf(slice.rows.map((row) => row.authorId));
    return {
      rows: slice.rows.map((row) => toModeratedPost(row, authors)),
      total: slice.total,
      page: window.page,
      pageSize: window.pageSize,
    };
  }

  /**
   * How many posts of one event are in each state (E59).
   *
   * For the heading of the section the plug-in draws on the organizer's
   * dashboard. Its own route rather than a field on the moderation list,
   * because the list is narrowed to the queue there and a narrowed list can
   * only count itself — and because the number belongs to the section, not to
   * whichever page of the list happens to be open. Built now, in AP 5, because
   * now a screen reads it (E21); AP 4 left it out for that reason.
   *
   * A state the event has no rows in is a zero rather than a missing key: SQL
   * groups what is there, and a heading that showed nothing where it should
   * show "0 rejected" would read as a broken heading.
   */
  async summarize(eventId: string): Promise<ForumSummary> {
    const counts = await this.forum.countPostsByStatus(eventId);
    return {
      pending: counts.get('pending') ?? 0,
      approved: counts.get('approved') ?? 0,
      rejected: counts.get('rejected') ?? 0,
    };
  }

  /** Publishes a post — and with it the thread, if it was the first (E51). */
  approve(postId: string, organizerId: string): Promise<ModeratedForumPost> {
    return this.decide(postId, 'approved', organizerId);
  }

  /** Refuses one, and the row stays where it was (E14, FR 4.6). */
  reject(postId: string, organizerId: string): Promise<ModeratedForumPost> {
    return this.decide(postId, 'rejected', organizerId);
  }

  private async decide(
    postId: string,
    status: Exclude<ForumPostStatus, 'pending'>,
    organizerId: string,
  ): Promise<ModeratedForumPost> {
    const decided = await this.forum.decide(
      postId,
      status,
      new Date(),
      organizerId,
    );
    if (!decided) {
      throw new NotFoundException(`No post with id ${postId}`);
    }
    return toModeratedPost(decided, await this.authorsOf([decided.authorId]));
  }

  /**
   * What a client may ask for, capped at what this endpoint will answer.
   *
   * The host's own function, reached through the contract rather than copied
   * into the plug-in (F138): a second reading of "page 0" is exactly the drift
   * that put it in one place.
   */
  private window(query: ForumPageQuery): PageWindow {
    return pageWindow(query, DEFAULT_FORUM_PAGE_SIZE, MAX_FORUM_PAGE_SIZE);
  }

  /** One question to the host for a whole page, whatever it lists (F49). */
  private authorsOf(
    ids: readonly string[],
  ): Promise<ReadonlyMap<string, PluginAuthor>> {
    return this.participants.findAuthors(ids);
  }
}

/**
 * The window in the terms a statement uses.
 *
 * `PageWindow` carries the page number as well, because the answer reports what
 * was actually read; SQL needs two of its three fields.
 */
function rows(window: PageWindow): { offset: number; limit: number } {
  return { offset: window.offset, limit: window.pageSize };
}

/** A body is what a person wrote, and whitespace is nothing written. */
function requireBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new BadRequestException('A post needs some text.');
  }
  return trimmed;
}

/** The one 404 for "not there" and "not yours to see" alike. */
function unknownThread(threadId: string): NotFoundException {
  return new NotFoundException(`No thread with id ${threadId}`);
}

function toThread(
  row: ThreadRecord,
  authors: ReadonlyMap<string, PluginAuthor>,
): ForumThread {
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.title,
    // Absent rather than invented: an id with no confirmed account behind it —
    // or no id at all, once that account was erased (E65) — is a row whose
    // owner is gone, and a placeholder name would be a person.
    author:
      row.createdBy === null ? null : (authors.get(row.createdBy) ?? null),
    createdAt: row.createdAt.toISOString(),
    lastPostAt: row.lastPostAt.toISOString(),
  };
}

function toPost(
  row: PostRecord,
  authors: ReadonlyMap<string, PluginAuthor>,
): ForumPost {
  return {
    id: row.id,
    threadId: row.threadId,
    body: row.body,
    status: row.status,
    author: authors.get(row.authorId) ?? null,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

function toModeratedPost(
  row: ModeratedPostRecord,
  authors: ReadonlyMap<string, PluginAuthor>,
): ModeratedForumPost {
  return {
    ...toPost(row, authors),
    thread: { id: row.threadId, title: row.threadTitle },
  };
}

/** Narrows away the openers that erasure left empty (E65). */
function isId(id: string | null): id is string {
  return id !== null;
}
