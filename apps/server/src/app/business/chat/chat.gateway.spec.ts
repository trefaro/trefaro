import type { Socket } from 'socket.io';
import { ChatGateway } from './chat.gateway';

function socket(id: string, transport = 'websocket'): Socket {
  return {
    id,
    conn: { transport: { name: transport } },
  } as unknown as Socket;
}

describe('ChatGateway', () => {
  it('echoes the message back with the socket id', () => {
    const reply = new ChatGateway().echo('hello', socket('abc'));

    expect(reply).toMatchObject({
      text: 'hello',
      socketId: 'abc',
      transport: 'websocket',
    });
    expect(new Date(reply.serverTime).toISOString()).toBe(reply.serverTime);
  });

  it('reports the transport, so a silent fallback to polling is visible', () => {
    const reply = new ChatGateway().echo('hello', socket('abc', 'polling'));

    expect(reply.transport).toBe('polling');
  });

  it('handles the connection lifecycle without touching the socket', () => {
    const gateway = new ChatGateway();

    expect(() => {
      gateway.handleConnection(socket('abc'));
      gateway.handleDisconnect(socket('abc'));
    }).not.toThrow();
  });
});
