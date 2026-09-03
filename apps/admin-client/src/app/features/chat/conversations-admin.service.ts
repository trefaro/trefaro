import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  GroupCandidate,
  MessageHistory,
  MessageHistoryQuery,
  NewGroupRequest,
  OrganizerConversationDetail,
  OrganizerConversationPage,
  OrganizerConversationQuery,
  OrganizerReply,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * The organization's messages, as the organizer client asks for them
 * (FR 3.4 — AP 10).
 *
 * Its own service rather than a method on something else, and no state: every
 * screen here reads a window and keeps it, the way the participant overview
 * does. What is worth naming is what this service does **not** do:
 *
 * - **It does not open a socket.** The participant client's chat is live
 *   (AP 7), and this one is not: the handshake authenticates a participant
 *   session (F132), the organization has no membership to be delivered to
 *   (F133), and the notification mail of a contact request is what spares the
 *   organizer from watching a screen (F172). A refresh is the button that is
 *   already there.
 * - **It does not follow a message's `imageUrl`.** That URL is served under
 *   `/api/media` and decides access by membership, which the organization does
 *   not have — so a picture is fetched with the administrative session and
 *   shown from a blob, the way a registration's attachment already is (E9).
 */
@Injectable({ providedIn: 'root' })
export class ConversationsAdminService {
  private readonly api = inject(ApiClient);

  list(query: OrganizerConversationQuery): Promise<OrganizerConversationPage> {
    return firstValueFrom(
      this.api.get<OrganizerConversationPage>('admin/conversations', {
        ...query,
      }),
    );
  }

  get(id: string): Promise<OrganizerConversationDetail> {
    return firstValueFrom(
      this.api.get<OrganizerConversationDetail>(`admin/conversations/${id}`),
    );
  }

  history(id: string, query: MessageHistoryQuery): Promise<MessageHistory> {
    return firstValueFrom(
      this.api.get<MessageHistory>(`admin/conversations/${id}/messages`, {
        ...query,
      }),
    );
  }

  /** Answers a conversation. The answer says what became of its mail (F174). */
  reply(id: string, body: string): Promise<OrganizerReply> {
    return firstValueFrom(
      this.api.post<OrganizerReply>(`admin/conversations/${id}/messages`, {
        body,
      }),
    );
  }

  /** Who may be put into a group for this event (E39). */
  candidates(eventId: string): Promise<readonly GroupCandidate[]> {
    return firstValueFrom(
      this.api.get<GroupCandidate[]>('admin/conversations/candidates', {
        eventId,
      }),
    );
  }

  createGroup(group: NewGroupRequest): Promise<OrganizerConversationDetail> {
    return firstValueFrom(
      this.api.post<OrganizerConversationDetail>('admin/conversations', group),
    );
  }

  /**
   * The bytes of a picture in a conversation, as an object URL.
   *
   * Fetched rather than linked to, for the reason the class comment gives.
   * The caller releases the URL — see the thread screen, which does it when it
   * is destroyed.
   */
  async image(conversationId: string, messageId: string): Promise<string> {
    const blob = await firstValueFrom(
      this.api.file(
        `admin/conversations/${conversationId}/messages/${messageId}/image`,
      ),
    );
    return URL.createObjectURL(blob);
  }
}
