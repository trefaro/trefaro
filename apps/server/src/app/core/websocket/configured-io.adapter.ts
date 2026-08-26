import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import type { TrefaroEnv } from '../config/env';

/**
 * socket.io adapter with the instance's origins allow-listed.
 *
 * A `@WebSocketGateway` decorator is evaluated before dependency injection
 * exists, so it cannot read configuration. Setting CORS here instead keeps the
 * allow-list derived from the configured client URLs rather than hard-coded or
 * left open.
 *
 * The default socket.io path `/socket.io` is kept on purpose: it is the path the
 * NGINX reverse proxy forwards with the `Upgrade` and `Connection` headers a
 * WebSocket handshake needs.
 */
export class ConfiguredIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly env: TrefaroEnv,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: [this.env.publicUserClientUrl, this.env.publicAdminClientUrl],
        credentials: true,
      },
    });
  }
}
