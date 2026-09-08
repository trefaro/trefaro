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
import { readJson, sendJson } from '@trefaro/shared-plugin-kit';

/**
 * This plug-in's own routes (FR 4.6).
 *
 * The routes are this plug-in's; the request itself — `fetch`, same-origin,
 * the 401 as a state and every other refusal with its status — is the kit's
 * since AP 6 of phase 4, when the third bundle would have copied it (F138).
 * The models are imported from `@trefaro/shared-models`, where the plug-in's
 * server DTOs implement the same interfaces.
 *
 * The `/api` prefix is not guessed: a plug-in's access level is part of its
 * path (E57), so `/api/participant/plugins/<key>/…` and
 * `/api/admin/plugins/<key>/…` are contract, not deployment.
 */
@Injectable({ providedIn: 'root' })
export class ForumApi {
  private readonly participantBase = `/api/participant/plugins/${FORUM_MODULE_KEY}`;
  private readonly adminBase = `/api/admin/plugins/${FORUM_MODULE_KEY}`;

  /** The threads a participant may see, latest published activity first. */
  listThreads(eventId: string, page: number): Promise<ForumThreadPage> {
    return readJson<ForumThreadPage>(
      `${this.participantBase}/events/${eventId}/threads?page=${page}`,
    );
  }

  /** Opens a thread with its first post; answers with both (F49). */
  openThread(
    eventId: string,
    input: NewForumThread,
  ): Promise<OpenedForumThread> {
    return sendJson<OpenedForumThread>(
      'POST',
      `${this.participantBase}/events/${eventId}/threads`,
      input,
    );
  }

  /** One thread with its posts — approved ones plus the reader's own (E51). */
  listPosts(threadId: string, page: number): Promise<ForumPostPage> {
    return readJson<ForumPostPage>(
      `${this.participantBase}/threads/${threadId}/posts?page=${page}`,
    );
  }

  reply(threadId: string, input: NewForumPost): Promise<ForumPost> {
    return sendJson<ForumPost>(
      'POST',
      `${this.participantBase}/threads/${threadId}/posts`,
      input,
    );
  }

  /** The moderation queue of one event: what is waiting for a decision. */
  listQueue(eventId: string, page: number): Promise<ForumModerationPage> {
    return readJson<ForumModerationPage>(
      `${this.adminBase}/events/${eventId}/posts?status=pending&page=${page}`,
    );
  }

  /** The three counts above that queue (E59). */
  summary(eventId: string): Promise<ForumSummary> {
    return readJson<ForumSummary>(
      `${this.adminBase}/events/${eventId}/summary`,
    );
  }

  approve(postId: string): Promise<ModeratedForumPost> {
    return sendJson<ModeratedForumPost>(
      'POST',
      `${this.adminBase}/posts/${postId}/approval`,
      {},
    );
  }

  reject(postId: string): Promise<ModeratedForumPost> {
    return sendJson<ModeratedForumPost>(
      'POST',
      `${this.adminBase}/posts/${postId}/rejection`,
      {},
    );
  }
}
