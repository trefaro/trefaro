import { Injectable, computed, signal } from '@angular/core';
import {
  CHAT_CONVERSATION,
  CHAT_JOIN,
  CHAT_LEAVE,
  CHAT_MESSAGE,
  CHAT_NAMESPACE,
  CHAT_READ,
  REALTIME_PATH,
  type ChatConversationEvent,
  type ChatJoinAck,
  type ChatMessage,
  type ChatReadEvent,
} from '@trefaro/shared-models';
import { Subject, type Observable } from 'rxjs';
import { io, type Socket } from 'socket.io-client';

export type RealtimeStatus =
  'disconnected' | 'connecting' | 'connected' | 'error';

/** How long a join may take before it is treated as refused. */
const JOIN_TIMEOUT_MS = 5_000;

/**
 * How long a handshake may take before it counts as failed.
 *
 * Shorter than socket.io's own twenty seconds on purpose. The number is not
 * about the network but about what a screen says while it waits: twenty
 * seconds of "connecting…" is a failure being hidden, and the honest sentence
 * — "no live connection, reload to see new messages" — is one somebody can
 * act on. A slow handshake is not lost work either, because the client
 * reconnects on its own; only the wording changes.
 *
 * It is also what makes the failure testable in a browser: the deployment
 * mistake this guards against is a proxy that forwards the upgrade and then
 * swallows everything (Spike 4), which produces exactly this timeout.
 */
const HANDSHAKE_TIMEOUT_MS = 8_000;

/**
 * The chat's socket, as a client sees it (FR 4.5, E41).
 *
 * Lives next to the HTTP client because both are "how a client talks to the
 * server", and it carries three things a screen needs and cannot get from a
 * request: a new message, a read receipt, and the news that one of my
 * conversations moved.
 *
 * **Connecting is authenticating.** The socket sends no token: it is admitted
 * on the session cookie, which the browser attaches because {@link
 * REALTIME_PATH} lies inside the path that cookie was issued for. So a socket
 * that fails to connect after a login has succeeded is a deployment problem
 * (a proxy that drops the upgrade), and a socket that fails before one is
 * simply an anonymous visitor — {@link error} carries the server's own
 * sentence for both.
 *
 * **Following a conversation is asking.** Membership is decided by the server
 * at {@link join}, so a client cannot listen to a conversation by knowing its
 * id. What this class adds is memory: the conversations it is following are
 * re-joined after a reconnect, because a dropped socket loses its rooms and a
 * screen that stopped updating silently is worse than one that reloads.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeClient {
  private socket: Socket | null = null;
  private readonly state = signal<RealtimeStatus>('disconnected');
  private readonly lastError = signal<string | null>(null);
  private readonly activeTransport = signal<string | null>(null);
  /** What to be in again after a reconnect. */
  private readonly following = new Set<string>();

  private readonly message$ = new Subject<ChatMessage>();
  private readonly read$ = new Subject<ChatReadEvent>();
  private readonly moved$ = new Subject<ChatConversationEvent>();

  readonly status = this.state.asReadonly();
  /** The server's own sentence when a handshake was refused (F77). */
  readonly error = this.lastError.asReadonly();
  /** Which transport the connection ended up on, once connected. */
  readonly transport = this.activeTransport.asReadonly();
  readonly isConnected = computed(() => this.state() === 'connected');

  /** A new line in a conversation this client is following. */
  readonly messages: Observable<ChatMessage> = this.message$.asObservable();
  /** Somebody read a conversation this client is following (E38). */
  readonly reads: Observable<ChatReadEvent> = this.read$.asObservable();
  /** One of my conversations moved — the list's signal, for any of them. */
  readonly conversations: Observable<ChatConversationEvent> =
    this.moved$.asObservable();

  connect(): void {
    if (this.socket) return;

    this.state.set('connecting');
    this.lastError.set(null);

    // Same origin, and the namespace as the first argument: the manager keeps
    // the page's own address, which is what makes the session cookie travel.
    const socket = io(CHAT_NAMESPACE, {
      path: REALTIME_PATH,
      // Skip long-polling on purpose: a proxy that drops the upgrade must fail
      // visibly instead of degrading into something that works until a
      // message has to be pushed.
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: true,
      reconnectionAttempts: 5,
      timeout: HANDSHAKE_TIMEOUT_MS,
    });

    socket.on('connect', () => {
      this.state.set('connected');
      this.lastError.set(null);
      this.activeTransport.set(socket.io.engine.transport.name);
      // A reconnect is a new socket in no rooms at all.
      for (const conversationId of this.following) {
        socket.emit(CHAT_JOIN, conversationId);
      }
    });
    socket.on('disconnect', () => {
      this.state.set('disconnected');
      this.activeTransport.set(null);
    });
    socket.on('connect_error', (error: Error) => {
      this.state.set('error');
      this.lastError.set(error.message);
    });

    socket.on(CHAT_MESSAGE, (message: ChatMessage) =>
      this.message$.next(message),
    );
    socket.on(CHAT_READ, (event: ChatReadEvent) => this.read$.next(event));
    socket.on(CHAT_CONVERSATION, (event: ChatConversationEvent) =>
      this.moved$.next(event),
    );

    this.socket = socket;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.following.clear();
    this.state.set('disconnected');
    this.activeTransport.set(null);
  }

  /**
   * Follows one conversation, if the server agrees.
   *
   * `false` for a conversation that is not this account's, for an id that is
   * not one, and for a socket that is not connected — the same three-into-one
   * answer the REST history gives (F157), plus the honest one for "there is no
   * socket to ask with". Resolves rather than rejects: a screen shows the
   * conversation either way, it only stops updating live.
   */
  join(conversationId: string): Promise<boolean> {
    const socket = this.socket;
    if (!socket?.connected) return Promise.resolve(false);

    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), JOIN_TIMEOUT_MS);
      socket.emit(CHAT_JOIN, conversationId, (ack: ChatJoinAck) => {
        clearTimeout(timer);
        if (ack?.joined) this.following.add(conversationId);
        resolve(Boolean(ack?.joined));
      });
    });
  }

  /** Stops following one. Always allowed, so there is nothing to wait for. */
  leave(conversationId: string): void {
    this.following.delete(conversationId);
    this.socket?.emit(CHAT_LEAVE, conversationId);
  }
}
