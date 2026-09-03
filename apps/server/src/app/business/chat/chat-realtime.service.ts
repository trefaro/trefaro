import { Injectable, Logger } from '@nestjs/common';
import {
  CHAT_CONVERSATION,
  CHAT_MESSAGE,
  CHAT_READ,
  type ChatConversationEvent,
  type ChatMessage,
  type ChatReadEvent,
} from '@trefaro/shared-models';
import type { ConversationMemberRef } from './ports/conversation.repository';

/**
 * The room that carries one conversation's lines.
 *
 * The prefix is not decoration: in socket.io every socket is itself a room
 * named after its id, so an unprefixed uuid could name a socket instead of a
 * conversation. The prefix keeps the two namespaces from meeting.
 */
export const conversationRoom = (conversationId: string): string =>
  `conversation:${conversationId}`;

/**
 * The room a member's own sockets sit in.
 *
 * Keyed by type **and** id, because a membership is (E39). Only participants
 * connect today; the organizer's side of the same naming is what AP 10 joins,
 * and until then emitting into it reaches nobody — which is the correct
 * behaviour for a room whose occupants have not been built yet, and cheaper
 * than a branch that would have to be removed again.
 */
export const memberRoom = (member: ConversationMemberRef): string =>
  `member:${member.memberType}:${member.memberId}`;

/**
 * The slice of a socket.io namespace this needs.
 *
 * Narrow on purpose: what the business layer has to be able to say is "send
 * this to everybody in that room", and a whole `Namespace` would also let it
 * accept connections, walk sockets and read handshakes. The gateway passes
 * itself in at boot ({@link ChatRealtimeService.attach}), and a test passes a
 * recorder.
 */
export interface ChatRoomHost {
  to(room: string): { emit(event: string, payload: unknown): unknown };
}

/**
 * Delivers what happened in a conversation to the sockets that care (E41).
 *
 * **Its own service rather than a method on the gateway**, and the reason is a
 * cycle: the gateway has to ask whether a socket may join a conversation, so
 * it depends on `ConversationsService` — and marking a conversation as read
 * has to be delivered, so that service would depend back on the gateway. Nest
 * would need a `forwardRef` for that, which this application has avoided
 * everywhere else by giving the shared thing its own name (F49, F100, F103).
 * Here the shared thing is "emit into a room", it knows nothing about
 * membership, and so it depends on nothing.
 *
 * **Delivery is best effort, storage is not.** A message is written and then
 * published; if publishing throws — a namespace closing during shutdown, a
 * socket.io internal — the request still succeeds. The alternative would be a
 * message that could not be stored because nobody was listening, and a client
 * that reloads sees everything anyway. It is also why nothing here awaits:
 * `emit` is fire-and-forget in socket.io, and pretending otherwise would put a
 * network round trip inside a database write's response time.
 */
@Injectable()
export class ChatRealtimeService {
  private readonly logger = new Logger(ChatRealtimeService.name);
  private host: ChatRoomHost | null = null;

  /** Called once, from the gateway's `afterInit`. */
  attach(host: ChatRoomHost): void {
    this.host = host;
  }

  /**
   * A new line: to the room of its conversation, and to every member's own
   * room.
   *
   * Two events rather than one, because they answer different questions. An
   * open thread wants the message; the conversation list wants to know that a
   * row moved, and it has to learn that even when nothing has joined the
   * conversation — which is every conversation a person is not reading right
   * now.
   */
  publishMessage(
    message: ChatMessage,
    members: readonly ConversationMemberRef[],
  ): void {
    this.emit(conversationRoom(message.conversationId), CHAT_MESSAGE, message);

    const moved: ChatConversationEvent = {
      conversationId: message.conversationId,
      at: message.createdAt,
    };
    for (const member of members) {
      this.emit(memberRoom(member), CHAT_CONVERSATION, moved);
    }
  }

  /**
   * Somebody read up to a point in time (E38).
   *
   * To the conversation, so the other side can show it, and to the reader's
   * own room, so their other devices stop showing a badge for something they
   * have read. Not to the other members' rooms: their unread count did not
   * change, and a list that re-read itself because somebody else caught up
   * would be work nobody asked for.
   */
  publishRead(
    conversationId: string,
    member: ConversationMemberRef,
    at: Date,
  ): void {
    const read: ChatReadEvent = {
      conversationId,
      memberType: member.memberType,
      memberId: member.memberId,
      at: at.toISOString(),
    };
    const moved: ChatConversationEvent = { conversationId, at: read.at };

    this.emit(conversationRoom(conversationId), CHAT_READ, read);
    this.emit(memberRoom(member), CHAT_CONVERSATION, moved);
  }

  private emit(room: string, event: string, payload: unknown): void {
    // No host means no gateway has initialised — a unit test, or a process
    // shutting down. Storage already happened; there is nothing to repair.
    if (!this.host) return;

    try {
      this.host.to(room).emit(event, payload);
    } catch (error: unknown) {
      this.logger.warn(
        `Could not deliver ${event} to ${room}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
