import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { REALTIME_PATH } from '@trefaro/shared-models';
import type { ServerOptions } from 'socket.io';
import type { TrefaroEnv } from '../config/env';
import { handshakeThrottle } from '../throttling/handshake-throttle';

/**
 * socket.io adapter with the instance's origins allow-listed.
 *
 * A `@WebSocketGateway` decorator is evaluated before dependency injection
 * exists, so it cannot read configuration. Setting CORS here instead keeps the
 * allow-list derived from the configured client URLs rather than hard-coded or
 * left open.
 *
 * The path is **not** the socket.io default. `REALTIME_PATH` puts the endpoint
 * under `/api`, because that is the path the participant session cookie is
 * issued for — a handshake anywhere else arrives without it, and since AP 7 of
 * phase 3 the handshake is what authenticates the socket (E41). The reverse
 * proxy forwards that path with the `Upgrade` and `Connection` headers a
 * WebSocket handshake needs; the constant is shared with both clients so the
 * three cannot disagree.
 *
 * `allowRequest` is the other thing a decorator could not have done, and it is
 * the only place a handshake can be counted at all: engine.io answers the
 * handshake itself, before Nest's router and therefore before `ThrottlerGuard`
 * — so until phase 5 every rate limit in this application counted zero of them
 * (see `throttling/handshake-throttle.ts`).
 */
export class ConfiguredIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly env: TrefaroEnv,
    private readonly storage: ThrottlerStorage,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      path: REALTIME_PATH,
      cors: {
        origin: [this.env.publicUserClientUrl, this.env.publicAdminClientUrl],
        credentials: true,
      },
      allowRequest: handshakeThrottle(this.storage),
    });
  }
}
