import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';

/**
 * Chat module (FR 4.5).
 *
 * Registered unconditionally: the gateway is inert until a client connects, and
 * the `chat` module flag decides whether the clients offer chat at all. Guarding
 * a WebSocket handshake by module configuration is a phase 3 concern, once
 * sockets are tied to authenticated users.
 */
@Module({ providers: [ChatGateway] })
export class ChatModule {}
