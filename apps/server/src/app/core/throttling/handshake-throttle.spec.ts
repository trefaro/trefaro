import { ThrottlerStorageService } from '@nestjs/throttler';
import type { IncomingMessage } from 'node:http';
import { handshakeThrottle } from './handshake-throttle';
import { RATE_LIMIT_DEFAULTS } from '../config/rate-limits';

function handshakeFrom(
  remoteAddress: string,
  forwardedFor?: string,
): IncomingMessage {
  return {
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
    socket: { remoteAddress },
  } as unknown as IncomingMessage;
}

describe('handshakeThrottle', () => {
  let storage: ThrottlerStorageService;
  let allowRequest: ReturnType<typeof handshakeThrottle>;

  /** One handshake attempt, answered the way engine.io answers it. */
  const knock = (request: IncomingMessage): Promise<boolean> =>
    new Promise((resolve) =>
      allowRequest(request, (_error, ok) => resolve(ok)),
    );

  beforeEach(() => {
    storage = new ThrottlerStorageService();
    allowRequest = handshakeThrottle(
      storage,
      RATE_LIMIT_DEFAULTS.globalRequestsPerMinute,
    );
  });

  afterEach(() => storage.onApplicationShutdown());

  it('lets an ordinary client connect', async () => {
    expect(await knock(handshakeFrom('10.0.0.7'))).toBe(true);
  });

  /*
   * The point of the whole file: engine.io answers the handshake before Nest's
   * router runs, so `ThrottlerGuard` never saw one of these. A client that
   * reconnects in a loop — or one that means to — could open sockets as fast as
   * the event loop allowed while every counter in the application read zero.
   */
  it('stops a handshake storm once the global budget is gone', async () => {
    const client = handshakeFrom('10.0.0.7');
    for (
      let attempt = 0;
      attempt < RATE_LIMIT_DEFAULTS.globalRequestsPerMinute;
      attempt++
    ) {
      expect(await knock(client)).toBe(true);
    }

    expect(await knock(client)).toBe(false);
  });

  it('gives every client address its own budget', async () => {
    const noisy = handshakeFrom('10.0.0.7');
    for (
      let attempt = 0;
      attempt <= RATE_LIMIT_DEFAULTS.globalRequestsPerMinute;
      attempt++
    )
      await knock(noisy);

    expect(await knock(noisy)).toBe(false);
    expect(await knock(handshakeFrom('10.0.0.8'))).toBe(true);
  });

  /*
   * Only the reverse proxy publishes a port, and it appends the real client to
   * `X-Forwarded-For` — so the last hop is the address Express hands the HTTP
   * counters under `trust proxy: 1`. Reading anything else here would either
   * count every client in the world as one (the proxy's address), or let a
   * caller pick their own bucket by writing the header themselves.
   */
  it('counts the hop the reverse proxy vouches for, not the proxy', async () => {
    const throughProxy = (client: string) =>
      handshakeFrom('172.18.0.2', `203.0.113.9, ${client}`);

    for (
      let attempt = 0;
      attempt <= RATE_LIMIT_DEFAULTS.globalRequestsPerMinute;
      attempt++
    ) {
      await knock(throughProxy('198.51.100.4'));
    }

    expect(await knock(throughProxy('198.51.100.4'))).toBe(false);
    expect(await knock(throughProxy('198.51.100.5'))).toBe(true);
  });

  it('still counts a handshake that arrives without any address at all', async () => {
    const anonymous = {
      headers: {},
      socket: {},
    } as unknown as IncomingMessage;

    expect(await knock(anonymous)).toBe(true);
  });
});
