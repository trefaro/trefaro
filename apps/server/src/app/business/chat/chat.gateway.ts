import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import {
  CHAT_JOIN,
  CHAT_LEAVE,
  CHAT_MODULE_KEY,
  CHAT_NAMESPACE,
  type ChatJoinAck,
} from '@trefaro/shared-models';
import type { Namespace, Socket } from 'socket.io';
import { CoreModuleRegistryService } from '../config';
import { UserSessionService, participantSessionFromHeader } from '../profiles';
import {
  ChatRealtimeService,
  PARTICIPANT_SOCKET_DATA,
  conversationRoom,
  memberRoom,
} from './chat-realtime.service';
import { ConversationsService } from './conversations.service';

/**
 * Why a handshake was refused, as the client sees it.
 *
 * Two sentences rather than one, because they are two states a client acts
 * differently on: no session means "log in", a switched-off module means
 * "this instance does not do this". Neither says anything a `GET /api/config`
 * would not — the enabled modules are in that payload, and whether a cookie is
 * valid is something its holder may know.
 */
const NO_SESSION = 'A participant session is required to open a chat socket.';
const CHAT_DISABLED = 'This instance has messaging switched off.';

/** A uuid, checked before it reaches a query — `ParseUUIDPipe`'s job (E33). */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The chat's real-time side (FR 4.5, E41) — the door and the rooms.
 *
 * **The handshake is the door, not the event.** A socket authenticates while
 * it is being established: socket.io runs namespace middleware before the
 * connection exists, so a refusal there arrives at the client as
 * `connect_error` rather than as a connected socket that ignores everything.
 * The alternative — checking on the first message — would mean an
 * unauthenticated socket sitting on the server, and every handler would have
 * to remember to ask.
 *
 * Two things are asked at the door, in the order the HTTP side asks them:
 *
 * 1. **The session**, from the same cookie and through the same service the
 *    participant guard uses (E34). One authentication for one kind of person;
 *    a second implementation of "resolve this cookie" is how one of them ends
 *    up outliving a revoked session.
 * 2. **The `chat` module flag**, from the same registry the endpoints' guard
 *    reads (F53). That a client does not offer a chat is not an assurance —
 *    and a socket is the one part of this application a client could open
 *    without ever loading a page of it.
 *
 * The order matters only for what a refusal says: an anonymous socket is told
 * about the session even when the module is off, exactly as an anonymous
 * request to a switched-off module's endpoint answers 401 rather than 404
 * (the participant guard is global and runs first).
 *
 * **The flag is asked at the door and not afterwards.** A socket that
 * connected before an organizer switched messaging off stays connected —
 * and stays inert: no message can be written and no receipt can be marked,
 * because those are the endpoints the guard already answers 404 for, so
 * nothing exists for this gateway to deliver. Dropping live sockets would be
 * the only place in this application where switching a module off takes
 * something away from somebody mid-sentence.
 *
 * **Rooms.** One per conversation, joined only on {@link CHAT_JOIN} and only
 * by a member; one per member, joined at connection time because a socket does
 * not have to ask to be told about itself. What travels into them is
 * {@link ChatRealtimeService}'s business — this class owns who may listen, not
 * what is said.
 */
@WebSocketGateway({ namespace: CHAT_NAMESPACE })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly sessions: UserSessionService,
    private readonly modules: CoreModuleRegistryService,
    private readonly conversations: ConversationsService,
    private readonly realtime: ChatRealtimeService,
  ) {}

  /**
   * Hands the namespace to the publisher and puts the door in front of it.
   *
   * `namespace.use` rather than a guard: a Nest `@UseGuards` on a gateway runs
   * for a **message**, and by then the connection already exists. The check
   * has to be part of the handshake for E41 to hold at all.
   */
  afterInit(namespace: Namespace): void {
    this.realtime.attach(namespace);

    namespace.use((socket, next) => {
      void this.admit(socket).then(
        () => next(),
        (error: unknown) =>
          next(error instanceof Error ? error : new Error(NO_SESSION)),
      );
    });
  }

  /**
   * Puts an admitted socket into its own member room.
   *
   * After the middleware rather than inside it, so that joining a room is done
   * on a socket that is connected — and so the two steps stay legible: the
   * middleware decides *whether*, this decides *where*.
   */
  handleConnection(client: Socket): void {
    const participantId = participantOf(client);
    if (!participantId) {
      // Unreachable: an unadmitted socket never connects. Belt and braces,
      // because the alternative is a socket in nobody's room that looks fine.
      client.disconnect(true);
      return;
    }

    void client.join(
      memberRoom({ memberType: 'user', memberId: participantId }),
    );
    this.logger.log(
      `Socket ${client.id} connected for participant ${participantId} via ${client.conn.transport.name}`,
    );
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Socket ${client.id} disconnected`);
  }

  /**
   * Follows one conversation, if it is the asker's (E41).
   *
   * The room is the only thing between a socket and somebody else's messages,
   * so this is where membership is decided — and it is decided by the service
   * that decides it for the REST history, through its non-throwing twin.
   * `{ joined: false }` covers "not a member", "no such conversation" and "not
   * a conversation id at all", for the reason the REST route answers one 404
   * for the first two (F157): an id somebody is not in is an id they must not
   * be able to confirm.
   */
  @SubscribeMessage(CHAT_JOIN)
  async join(
    @MessageBody() conversationId: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<ChatJoinAck> {
    const participantId = participantOf(client);
    if (!participantId || !isUuid(conversationId)) return { joined: false };

    const membership = await this.conversations.membershipOf(
      participantId,
      conversationId,
    );
    if (!membership) return { joined: false };

    await client.join(conversationRoom(conversationId));
    return { joined: true };
  }

  /**
   * Stops following one conversation.
   *
   * No check: a socket can only leave a room it is in, and leaving one it is
   * not in is a no-op. Asking for membership here would refuse to let go of a
   * conversation somebody was just removed from.
   */
  @SubscribeMessage(CHAT_LEAVE)
  async leave(
    @MessageBody() conversationId: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    if (!isUuid(conversationId)) return;
    await client.leave(conversationRoom(conversationId));
  }

  /** The door itself. Throws to refuse; the message reaches the client. */
  private async admit(socket: Socket): Promise<void> {
    const token = participantSessionFromHeader(socket.handshake.headers.cookie);
    if (!token) throw new Error(NO_SESSION);

    const participant = await this.sessions.resolve(token);
    if (!participant) throw new Error(NO_SESSION);

    if (!this.modules.isEnabled(CHAT_MODULE_KEY)) {
      throw new Error(CHAT_DISABLED);
    }

    socket.data[PARTICIPANT_SOCKET_DATA] = participant.profile.id;
  }
}

/** The participant a socket was admitted for, or `null`. */
function participantOf(client: Socket): string | null {
  const participantId: unknown = client.data[PARTICIPANT_SOCKET_DATA];
  return typeof participantId === 'string' ? participantId : null;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
