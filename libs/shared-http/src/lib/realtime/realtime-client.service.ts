import { Injectable, computed, signal } from '@angular/core';
import { io, type Socket } from 'socket.io-client';

export type RealtimeStatus =
  'disconnected' | 'connecting' | 'connected' | 'error';

export interface RealtimeEchoReply {
  readonly text: string;
  readonly serverTime: string;
  readonly socketId: string;
  /** `websocket` once the upgrade succeeded, `polling` if it fell back. */
  readonly transport: string;
}

/** How long an echo may take before it is treated as lost. */
const ECHO_TIMEOUT_MS = 5_000;

/**
 * Realtime connection to the server's socket.io gateway.
 *
 * Lives next to the HTTP client because both are "how a client talks to the
 * server"; the chat features that will use it (FR 4.5) arrive in phase 3.
 *
 * The path stays the default `/socket.io`, which the dev server proxies and the
 * NGINX configuration forwards with the `Upgrade` and `Connection` headers a
 * WebSocket handshake needs.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeClient {
  private socket: Socket | null = null;
  private readonly state = signal<RealtimeStatus>('disconnected');
  private readonly lastError = signal<string | null>(null);
  private readonly activeTransport = signal<string | null>(null);

  readonly status = this.state.asReadonly();
  readonly error = this.lastError.asReadonly();
  /** Which transport the connection ended up on, once connected. */
  readonly transport = this.activeTransport.asReadonly();
  readonly isConnected = computed(() => this.state() === 'connected');

  connect(): void {
    if (this.socket) return;

    this.state.set('connecting');
    this.lastError.set(null);

    // Same origin: in development the dev server proxies the upgrade, in
    // production NGINX does.
    const socket = io({
      // Skip long-polling so a proxy that drops the upgrade fails visibly
      // instead of silently degrading — which is exactly what the spike checks.
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      this.state.set('connected');
      this.activeTransport.set(socket.io.engine.transport.name);
    });
    socket.on('disconnect', () => {
      this.state.set('disconnected');
      this.activeTransport.set(null);
    });
    socket.on('connect_error', (error: Error) => {
      this.state.set('error');
      this.lastError.set(error.message);
    });

    this.socket = socket;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.state.set('disconnected');
    this.activeTransport.set(null);
  }

  /**
   * Sends a probe through the socket and waits for the server's reply.
   *
   * Rejects on timeout rather than hanging: a reverse proxy that accepts the
   * handshake but drops frames looks like a connected socket that never answers.
   */
  echo(text: string): Promise<RealtimeEchoReply> {
    const socket = this.socket;
    if (!socket?.connected) {
      return Promise.reject(new Error('Not connected'));
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`No reply within ${ECHO_TIMEOUT_MS} ms`)),
        ECHO_TIMEOUT_MS,
      );
      socket.emit('chat:echo', text, (reply: RealtimeEchoReply) => {
        clearTimeout(timer);
        resolve(reply);
      });
    });
  }
}
