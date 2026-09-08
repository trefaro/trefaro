/**
 * Payloads of the discussion forum plug-in (FR 4.6).
 *
 * In `shared-models` like every other payload of this application, and for the
 * reason the proposals gave first: a client that loads a plug-in's bundle shares
 * the **models** with it, never the implementation. The plug-in's server DTOs
 * implement these interfaces, so a change to the contract breaks a build rather
 * than a request.
 *
 * The plug-in's key and its catalogue namespace are declared by its server
 * descriptor; what lives here is only what travels over HTTP.
 */

/** The plug-in's stable key — also its `module_config.module_key`. */
export const FORUM_MODULE_KEY = 'forum';

/**
 * The three states a post can be in (E51).
 *
 * The same decision the proposals carry, and deliberately its own constant: a
 * forum post and a programme proposal are two things an organizer decides on,
 * and the third thing that would justify one shared type does not exist —
 * neither the check-in nor the personal programme is moderated (F138).
 *
 * A **thread** has no status of its own (F195). It is visible as soon as one of
 * its posts is approved; a second status column would be a second moderation
 * surface for the same decision.
 */
export const FORUM_POST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ForumPostStatus = (typeof FORUM_POST_STATUSES)[number];

/** Same limit as a programme item's title — a thread is read in a list too. */
export const MAX_FORUM_THREAD_TITLE_LENGTH = 200;
/** Same limit as a chat message: a post is a contribution, not a page. */
export const MAX_FORUM_POST_LENGTH = 4000;

export const DEFAULT_FORUM_PAGE_SIZE = 20;
export const MAX_FORUM_PAGE_SIZE = 100;

/**
 * Who wrote something, as a reader sees them.
 *
 * A name and a picture, never an address (F55). A post is attributed by
 * nature: the other participants see who they are talking with, and an
 * organizer moderating a post needs to know whose it is.
 */
export interface ForumAuthor {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

/**
 * One thread.
 *
 * `author` is who opened it — `null` when that account is gone, which is not an
 * anonymous thread but a missing person; a placeholder name would invent one.
 *
 * `lastPostAt` is the moment of the latest **published** post, or the thread's
 * own creation while none is (F195): the list is sorted by it, and a reader
 * must not see a thread jump to the top because of a post they cannot read.
 */
export interface ForumThread {
  readonly id: string;
  readonly eventId: string;
  readonly title: string;
  readonly author: ForumAuthor | null;
  /** ISO 8601, like every instant this application hands out. */
  readonly createdAt: string;
  readonly lastPostAt: string;
}

/**
 * One post.
 *
 * There is deliberately no "is this mine" flag, for the reason the proposals
 * gave (F194): the reader has their own id in their session, and a field whose
 * meaning depends on the endpoint gets read on the wrong one. What a reader can
 * rely on instead is the rule of E51 — a post in their list that is **not**
 * approved can only be their own.
 */
export interface ForumPost {
  readonly id: string;
  readonly threadId: string;
  readonly body: string;
  readonly status: ForumPostStatus;
  readonly author: ForumAuthor | null;
  readonly createdAt: string;
  /** When it was approved or rejected; `null` while it is pending. */
  readonly decidedAt: string | null;
}

/** The thread a moderated post is in — enough to show it in context. */
export interface ForumThreadReference {
  readonly id: string;
  readonly title: string;
}

/**
 * One post in the organizer's moderation list, with the thread it belongs to.
 *
 * The organization decides post by post (E51), but a post out of context is a
 * sentence without its question — so the row carries the thread's title, and
 * the client draws each one "in the context of its thread" (AP 5).
 */
export interface ModeratedForumPost extends ForumPost {
  readonly thread: ForumThreadReference;
}

/** What a participant sends to open a thread: a title and the first post. */
export interface NewForumThread {
  readonly title: string;
  readonly body: string;
}

/** What a participant sends to reply. */
export interface NewForumPost {
  readonly body: string;
}

/**
 * What opening a thread answers: the thread and its first post, both as
 * created.
 *
 * Both rather than the thread alone, because the screen that follows shows
 * both — the thread with its one pending post and the status on it — and a
 * screen is one request (F49).
 */
export interface OpenedForumThread {
  readonly thread: ForumThread;
  readonly post: ForumPost;
}

/** One page of a participant's thread list, latest activity first. */
export interface ForumThreadPage {
  readonly rows: readonly ForumThread[];
  /** What the pages divide — the whole result, not this page's length. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/**
 * One page of a thread's posts, oldest first, with the thread itself.
 *
 * The thread rides along because the thread view is one screen: its title and
 * who opened it, then the posts. A deep link into a thread must not need a
 * second route the plan does not have.
 */
export interface ForumPostPage {
  readonly thread: ForumThread;
  readonly rows: readonly ForumPost[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** One page of the organizer's moderation list, newest first. */
export interface ForumModerationPage {
  readonly rows: readonly ModeratedForumPost[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** What a participant's list may ask for. */
export interface ForumPageQuery {
  readonly page?: number;
  readonly pageSize?: number;
}

/**
 * What the moderation list may ask for.
 *
 * `status` exists only here: a participant's lists are narrowed by the rule of
 * E51 in the statement, never by a parameter — a parameter that changed nothing
 * would be a promise the endpoint does not keep.
 */
export interface ForumModerationQuery extends ForumPageQuery {
  readonly status?: ForumPostStatus;
}
