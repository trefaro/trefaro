import { Injectable, Logger } from '@nestjs/common';
import {
  participantConversationPath,
  type ChatMessage,
} from '@trefaro/shared-models';
import { PushService } from '../push';
import { ChatRealtimeService } from './chat-realtime.service';
import type { ConversationMemberRef } from './ports/conversation.repository';

/**
 * Tells the members who were not there that something was said (E44, FR 3.15).
 *
 * **The complement of live delivery, and that is the whole idea.** A message
 * is emitted into the room of its conversation; whoever is in that room has
 * already seen it before any push service could be reached. This service is
 * for everybody else — and only for them, because a notification about
 * something somebody is reading in that same second is the kind people switch
 * off, and then never hear the ones that mattered.
 *
 * Three exclusions, in order:
 *
 * 1. **The sender.** Nobody needs telling what they just wrote.
 * 2. **Members without an account.** A membership can point at an
 *    administrator (E39), and the organization has no participant devices —
 *    its side is a screen it works at, and it hears about a contact request by
 *    mail (F172). An `organizer_contact` conversation has no membership row
 *    for that side at all (F133), so there is usually nothing to skip.
 * 3. **Whoever is watching this conversation.** The question {@link
 *    ChatRealtimeService.watchersOf} answers.
 *
 * **Its own service** rather than a branch inside `ChatRealtimeService`, which
 * has one job and no dependencies on purpose, and rather than a method on
 * `MessagesService`, which would leave the organizer's reply (AP 10) without
 * it. Both writers call this, and both call it the same way.
 *
 * **Nothing here can fail a message.** The row is stored before anybody is
 * notified; every error is logged and swallowed, exactly as a failed live
 * delivery is. A message that could not be stored because a phone was
 * unreachable would be the wrong trade in every direction.
 */
@Injectable()
export class ChatNotificationsService {
  private readonly logger = new Logger(ChatNotificationsService.name);

  constructor(
    private readonly realtime: ChatRealtimeService,
    private readonly push: PushService,
  ) {}

  /**
   * Notifies the members of a conversation who are not watching it.
   *
   * Returns when every delivery attempt is done, so a caller *can* await it —
   * and the two callers deliberately do not: a browser vendor's push service
   * is not something a person pressing "send" should wait for. The promise is
   * returned all the same, because a test that cannot await it would have to
   * guess how many microtasks a notification takes.
   */
  async notifyAbsent(
    message: ChatMessage,
    members: readonly ConversationMemberRef[],
  ): Promise<void> {
    try {
      const recipients = members.filter(
        (member) =>
          member.memberType === 'user' && member.memberId !== message.senderId,
      );
      if (recipients.length === 0) return;

      const watching = await this.realtime.watchersOf(message.conversationId);
      const absent = recipients.filter(
        (member) => !watching.has(member.memberId),
      );
      if (absent.length === 0) return;

      const notice = {
        path: participantConversationPath(message.conversationId),
      };
      await Promise.all(
        absent.map((member) =>
          this.push.notifyParticipant(member.memberId, notice),
        ),
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Could not notify about message ${message.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
