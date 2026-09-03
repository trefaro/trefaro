import { Injectable, inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import { ApiClient } from '@trefaro/shared-http';
import {
  CHAT_MODULE_KEY,
  MESSAGE_IMAGE_PART,
  type ChatMessage,
  type ConversationPage,
  type ConversationQuery,
  type ConversationSummary,
  type MessageHistory,
  type MessageHistoryQuery,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/** What one send carries — text, a picture, or both, never nothing (E40). */
export interface OutgoingMessage {
  readonly body?: string;
  readonly image?: File | null;
}

/**
 * The conversations of the signed-in participant, from the client side
 * (FR 4.5, UC 13).
 *
 * Five calls, and they are the five endpoints of AP 6 — nothing is composed
 * here, because the server already answers what a screen shows: the list
 * arrives counted (E38) and sorted, the history arrives as a window.
 *
 * Two things worth naming:
 *
 * - **Sending is one method with two shapes.** With a picture the body has to
 *   be `FormData`, without one it is plain JSON, and the endpoint takes both
 *   (multer skips a request that is not multipart). Keeping that in one method
 *   rather than two is what lets a composer stay a composer: it has a text box
 *   and an optional picture, not two ways to send.
 * - **No language travels with any of it.** Nothing in a conversation is
 *   translated — a message is what somebody wrote — so `?locale=` would be a
 *   parameter none of these endpoints declares, exactly as in the participant
 *   search.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(ApiClient);

  list(query: ConversationQuery = {}): Promise<ConversationPage> {
    return firstValueFrom(
      this.api.get<ConversationPage>('participant/conversations', { ...query }),
    );
  }

  /**
   * One conversation of mine, for the screen that shows it.
   *
   * @throws ApiError — 404 for a conversation that is not this account's,
   * said the same way as for an id that never existed (F157).
   */
  get(conversationId: string): Promise<ConversationSummary> {
    return firstValueFrom(
      this.api.get<ConversationSummary>(
        `participant/conversations/${encodeURIComponent(conversationId)}`,
      ),
    );
  }

  /**
   * Opens the conversation with another participant, or finds the one that
   * exists (E37).
   *
   * @throws ApiError — 403 for anybody who may not be written to (said the
   * same way for four different reasons, F124), 400 for one's own id.
   */
  start(profileId: string): Promise<ConversationSummary> {
    return firstValueFrom(
      this.api.post<ConversationSummary>('participant/conversations', {
        profileId,
      }),
    );
  }

  /**
   * One window of the history, newest first.
   *
   * @throws ApiError — 404 for a conversation that is not this account's, said
   * the same way as for an id that never existed (F157).
   */
  history(
    conversationId: string,
    query: MessageHistoryQuery = {},
  ): Promise<MessageHistory> {
    return firstValueFrom(
      this.api.get<MessageHistory>(
        `participant/conversations/${encodeURIComponent(conversationId)}/messages`,
        { ...query },
      ),
    );
  }

  /** @throws ApiError — 400 for an empty message, 413 for a picture too big. */
  send(conversationId: string, message: OutgoingMessage): Promise<ChatMessage> {
    const path = `participant/conversations/${encodeURIComponent(conversationId)}/messages`;
    return firstValueFrom(this.api.post<ChatMessage>(path, bodyOf(message)));
  }

  /** Marks everything up to now as read (E38). Answers nothing. */
  markRead(conversationId: string): Promise<void> {
    return firstValueFrom(
      this.api.put<void>(
        `participant/conversations/${encodeURIComponent(conversationId)}/read`,
        {},
      ),
    );
  }
}

/**
 * The request body: multipart with a picture, JSON without one.
 *
 * The text goes into `FormData` as an ordinary form field rather than into a
 * `payload` part, because a message has no nested fields to wrap — the
 * difference from a registration with a file (F39) is written down in
 * `MESSAGE_IMAGE_PART` itself.
 */
function bodyOf(message: OutgoingMessage): FormData | { body?: string } {
  const body = message.body?.trim() ?? '';

  if (!message.image) return body ? { body } : {};

  const form = new FormData();
  if (body) form.set('body', body);
  // No third argument: a `File` carries its own name, and passing it again
  // makes `FormData` wrap the file in a copy.
  form.set(MESSAGE_IMAGE_PART, message.image);
  return form;
}

/**
 * Keeps the chat off an instance that does not run one (F53, E42).
 *
 * The twin of `profileSearchGuard`, and beside `participantSessionGuard` for
 * the same reason: the session decides whether somebody may see a page, this
 * decides whether the page exists on this instance at all. An organization
 * that keeps a participant directory without messaging switches `chat` off,
 * and then every conversation endpoint answers 404 — a screen that showed an
 * empty list instead would invite somebody to wait for a message that can
 * never arrive.
 */
export const chatGuard: CanActivateFn = () => {
  const config = inject(AppConfigService);
  const router = inject(Router);

  return config.isModuleEnabled(CHAT_MODULE_KEY)
    ? true
    : router.createUrlTree(['/']);
};
