import type { ForumPostStatus } from '@trefaro/shared-models';

/**
 * Port for the forum's storage (FR 4.6): threads and the posts in them.
 *
 * One port over two tables, and not two ports, because a thread and its posts
 * are one thing written together: opening a thread **is** writing its first
 * post, in one transaction, and a decision on a post moves the thread it is in.
 * A port per table would have put the transaction into the service, which may
 * not know there is one (strict layering).
 *
 * What the port deliberately does not offer is a way to read an event or an
 * account. Both are core tables the plug-in owns nothing of (F21): the
 * references are enforced by the database, and what the plug-in knows about a
 * person is a name it asks the host for (E58).
 *
 * Three rules live in the statements rather than in a caller (F152):
 *
 * - **A thread is visible when a post in it is** (E51, F195). "Visible to V"
 *   means: some post of the thread is approved, or some post of the thread is
 *   V's own. {@link findThreadsForParticipant}, {@link findPostsForParticipant}
 *   and {@link addPost} all carry that condition, so there is no way to ask
 *   this port for a stranger's unpublished thread — and no way to reply into
 *   one either.
 * - **A participant reads approved posts plus their own.** The same clause on
 *   the post rows, which is the whole of FR 4.6's promise that a person sees
 *   what became of what they wrote.
 * - **A decision has a time.** {@link decide} writes status and instant
 *   together, because the table's check constraint refuses any other
 *   combination — and recomputes the thread's `last_post_at` in the same
 *   transaction, so the order of the list follows what is published.
 */

/** One thread as the business layer sees it — no ORM types. */
export interface ThreadRecord {
  readonly id: string;
  readonly eventId: string;
  readonly title: string;
  /**
   * Who opened it, or `null` once that account was erased (E65).
   *
   * A thread outlives its opener because it is the container for other
   * people's posts; a post does not, because a post is one person's words
   * (E58). The payload has carried a nullable author since F195, so nothing
   * above this line had to change when the column became nullable.
   */
  readonly createdBy: string | null;
  readonly createdAt: Date;
  /** The latest published post, or `createdAt` while there is none (F195). */
  readonly lastPostAt: Date;
}

/** One post as the business layer sees it. */
export interface PostRecord {
  readonly id: string;
  readonly threadId: string;
  readonly authorId: string;
  readonly body: string;
  readonly status: ForumPostStatus;
  /** `null` while it is pending — the pair the check constraint enforces. */
  readonly decidedAt: Date | null;
  /** Who decided, or `null` if that account is gone (`ON DELETE SET NULL`). */
  readonly decidedBy: string | null;
  readonly createdAt: Date;
}

/** A post with the thread it is in — what the organizer's list shows. */
export interface ModeratedPostRecord extends PostRecord {
  readonly threadTitle: string;
}

export interface OpenThreadInput {
  readonly eventId: string;
  readonly authorId: string;
  readonly title: string;
  readonly body: string;
}

export interface AddPostInput {
  readonly threadId: string;
  readonly authorId: string;
  readonly body: string;
}

/** The window a list reads, already resolved from what a client asked for. */
export interface ForumWindow {
  readonly offset: number;
  readonly limit: number;
}

/** One page, with what the pages divide counted in the same statement. */
export interface ForumSlice<T> {
  readonly rows: readonly T[];
  readonly total: number;
}

/** A thread's posts, with the thread — `null` is "not visible to you". */
export interface ThreadPosts extends ForumSlice<PostRecord> {
  readonly thread: ThreadRecord;
}

/**
 * Raised when the event a thread is opened in does not exist.
 *
 * Narrow on purpose: the event's foreign key cascades, so this is an event
 * deleted between the page load and the submission. The data access layer
 * translates the constraint violation into this error so the business layer
 * can answer 404 rather than 500 — the driver's error code stays where the ORM
 * does.
 */
export class UnknownForumEventError extends Error {
  constructor(readonly eventId: string) {
    super('No such event');
    this.name = 'UnknownForumEventError';
  }
}

export interface ForumRepository {
  /**
   * The threads of one event a participant may see (E51, F195).
   *
   * Every thread with an approved post, plus every thread the reader has
   * written in whatever the status — latest published activity first, the id
   * as the last criterion.
   */
  findThreadsForParticipant(
    eventId: string,
    viewerId: string,
    window: ForumWindow,
  ): Promise<ForumSlice<ThreadRecord>>;

  /**
   * Opens a thread with its first post, both in one transaction.
   *
   * The post starts out pending, and the thread is therefore visible to its
   * author and the organization only until somebody decides.
   *
   * @throws UnknownForumEventError
   */
  openThread(
    input: OpenThreadInput,
  ): Promise<{ thread: ThreadRecord; post: PostRecord }>;

  /**
   * What one participant may see of one thread: approved posts plus their own,
   * oldest first — with the thread itself.
   *
   * `null` when there is no such thread **or** the thread is not visible to
   * this reader: the two are one answer, so that a guessed id learns nothing.
   */
  findPostsForParticipant(
    threadId: string,
    viewerId: string,
    window: ForumWindow,
  ): Promise<ThreadPosts | null>;

  /**
   * Replies to a thread, pending.
   *
   * `null` when there is no such thread or it is not visible to the author —
   * the same answer as {@link findPostsForParticipant} gives, for the same
   * reason: one cannot write into a conversation one cannot read.
   */
  addPost(input: AddPostInput): Promise<PostRecord | null>;

  /**
   * The organizer's moderation list for one event, optionally by status.
   *
   * No visibility filter: the organization moderates, so it sees everything of
   * its own event — and only of its own event, which the join to the thread
   * decides. Newest first, like the proposals' queue.
   */
  findPostsForEvent(
    eventId: string,
    status: ForumPostStatus | undefined,
    window: ForumWindow,
  ): Promise<ForumSlice<ModeratedPostRecord>>;

  /**
   * How many posts of one event are in each state (E59).
   *
   * One statement over the join to the thread, grouped by status. A state with
   * no rows is absent from the result and the caller fills in a zero — SQL
   * groups what is there, not what could have been.
   */
  countPostsByStatus(
    eventId: string,
  ): Promise<ReadonlyMap<ForumPostStatus, number>>;

  /**
   * Records one decision (E51) and moves the thread with it.
   *
   * `null` when the row was already gone. Writing an already-decided row again
   * is allowed and moves the instant: a decision may be corrected, and refusing
   * a correction would need a reason FR 4.6 does not give. The thread's
   * `last_post_at` is recomputed from what is now published, in the same
   * transaction.
   */
  decide(
    postId: string,
    status: Exclude<ForumPostStatus, 'pending'>,
    decidedAt: Date,
    decidedBy: string,
  ): Promise<ModeratedPostRecord | null>;
}

export const FORUM_REPOSITORY = Symbol('TREFARO_FORUM_REPOSITORY');
