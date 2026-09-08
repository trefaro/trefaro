import { Injectable } from '@angular/core';
import {
  FORUM_MODULE_KEY,
  type ForumModerationPage,
  type ForumPost,
  type ForumPostPage,
  type ForumSummary,
  type ForumThreadPage,
  type ModeratedForumPost,
  type NewForumPost,
  type NewForumThread,
  type OpenedForumThread,
} from '@trefaro/shared-models';

/**
 * Raised when the instance says there is no session (401).
 *
 * Its own error class because it is not a failure: posts are interactions and
 * sit behind the login (E58), while the element is mounted for everybody — so
 * "no session" is a **state this plug-in renders**, an invitation to log in,
 * and not something to report as broken.
 */
export class NotSignedInError extends Error {
  constructor() {
    super('No participant session');
    this.name = 'NotSignedInError';
  }
}

/** Anything else the server said no to, with the status for the console. */
export class ForumRequestError extends Error {
  constructor(readonly status: number) {
    super(`The forum endpoint answered ${status}`);
    this.name = 'ForumRequestError';
  }
}

/**
 * This plug-in's own routes, over `fetch` (FR 4.6).
 *
 * The same shape as the proposals' `ProposalsApi`, and knowingly a second copy
 * of it (F138): what a client shares with a plug-in bundle are the *models*,
 * never the implementation, and a bundle fetched at runtime carries no second
 * HTTP stack for eight calls whose only special need is to read a status code.
 * The models are imported from `@trefaro/shared-models`, where the plug-in's
 * server DTOs implement the same interfaces. A third bundle with the same
 * needs is the one at which these forty lines move into a shared library.
 *
 * The `/api` prefix is not guessed: a plug-in's access level is part of its
 * path (E57), so `/api/participant/plugins/<key>/…` and
 * `/api/admin/plugins/<key>/…` are contract, not deployment. Both clients are
 * served from the same origin as the API — in production through the reverse
 * proxy, in development through each client's dev-server proxy — which is why
 * the cookie travels and no address of a foreign host appears anywhere in this
 * bundle (NFR 9).
 */
@Injectable({ providedIn: 'root' })
export class ForumApi {
  private readonly participantBase = `/api/participant/plugins/${FORUM_MODULE_KEY}`;
  private readonly adminBase = `/api/admin/plugins/${FORUM_MODULE_KEY}`;

  /** The threads a participant may see, latest published activity first. */
  listThreads(eventId: string, page: number): Promise<ForumThreadPage> {
    return this.read<ForumThreadPage>(
      `${this.participantBase}/events/${eventId}/threads?page=${page}`,
    );
  }

  /** Opens a thread with its first post; answers with both (F49). */
  openThread(
    eventId: string,
    input: NewForumThread,
  ): Promise<OpenedForumThread> {
    return this.write<OpenedForumThread>(
      `${this.participantBase}/events/${eventId}/threads`,
      input,
    );
  }

  /** One thread with its posts — approved ones plus the reader's own (E51). */
  listPosts(threadId: string, page: number): Promise<ForumPostPage> {
    return this.read<ForumPostPage>(
      `${this.participantBase}/threads/${threadId}/posts?page=${page}`,
    );
  }

  reply(threadId: string, input: NewForumPost): Promise<ForumPost> {
    return this.write<ForumPost>(
      `${this.participantBase}/threads/${threadId}/posts`,
      input,
    );
  }

  /** The moderation queue of one event: what is waiting for a decision. */
  listQueue(eventId: string, page: number): Promise<ForumModerationPage> {
    return this.read<ForumModerationPage>(
      `${this.adminBase}/events/${eventId}/posts?status=pending&page=${page}`,
    );
  }

  /** The three counts above that queue (E59). */
  summary(eventId: string): Promise<ForumSummary> {
    return this.read<ForumSummary>(
      `${this.adminBase}/events/${eventId}/summary`,
    );
  }

  approve(postId: string): Promise<ModeratedForumPost> {
    return this.write<ModeratedForumPost>(
      `${this.adminBase}/posts/${postId}/approval`,
      {},
    );
  }

  reject(postId: string): Promise<ModeratedForumPost> {
    return this.write<ModeratedForumPost>(
      `${this.adminBase}/posts/${postId}/rejection`,
      {},
    );
  }

  private read<T>(path: string): Promise<T> {
    return this.send<T>(path, { method: 'GET' });
  }

  private write<T>(path: string, body: unknown): Promise<T> {
    return this.send<T>(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async send<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(path, {
      ...init,
      // The session is a cookie on `/api`, and the request is same-origin —
      // spelled out rather than left to the default, because this is the line
      // that decides whether the server knows who is asking.
      credentials: 'same-origin',
      // Last, so a caller's content type is kept and neither of these can be
      // dropped by one.
      headers: { accept: 'application/json', ...(init.headers ?? {}) },
    });

    if (response.status === 401) throw new NotSignedInError();
    if (!response.ok) throw new ForumRequestError(response.status);
    return (await response.json()) as T;
  }
}
