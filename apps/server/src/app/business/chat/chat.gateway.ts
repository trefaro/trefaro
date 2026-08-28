import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';

/** Reply to a connectivity probe. */
export interface ChatEchoReply {
  readonly text: string;
  /** Server time, so a client can see the round trip actually reached us. */
  readonly serverTime: string;
  readonly socketId: string;
  /** `websocket` once the upgrade succeeded, `polling` if it silently fell back. */
  readonly transport: string;
}

/**
 * Real-time chat gateway (FR 4.5).
 *
 * Still carries only what the WebSocket spike of phase 0 needed: the connection
 * lifecycle and an echo message that proves a socket.io upgrade survives the
 * NGINX reverse proxy from both clients. Conversations, groups and image exchange arrive in
 * phase 3 and replace the echo handler.
 *
 * Origins are allow-listed by `ConfiguredIoAdapter`, which can read the
 * environment — a gateway decorator cannot.
 */
@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log(
      `Socket ${client.id} connected via ${client.conn.transport.name}`,
    );
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Socket ${client.id} disconnected`);
  }

  /**
   * Connectivity probe used by the WebSocket spike.
   *
   * Reports the transport it was served over, which is what distinguishes a
   * working upgrade from long-polling that merely looks like one.
   */
  @SubscribeMessage('chat:echo')
  echo(
    @MessageBody() text: string,
    @ConnectedSocket() client: Socket,
  ): ChatEchoReply {
    return {
      text,
      serverTime: new Date().toISOString(),
      socketId: client.id,
      transport: client.conn.transport.name,
    };
  }
}
