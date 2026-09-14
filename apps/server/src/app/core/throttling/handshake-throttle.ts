import { ThrottlerStorage } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { GLOBAL_LIMIT, GLOBAL_WINDOW } from './throttlers';

/**
 * The counter for the one request `@nestjs/throttler` has never seen.
 *
 * A socket.io handshake is an ordinary HTTP request, but engine.io answers it
 * itself — before Nest's router, and therefore before `ThrottlerGuard`. Every
 * limit in this application counted zero of them. A client that reconnects in a
 * loop, or one that means to, could open sockets as fast as the event loop
 * allowed, and the only sign would be the memory.
 *
 * It is counted against the **same budget as every other request** rather than
 * one of its own, and that is the argument: nothing about a handshake makes it
 * worth more than a page load, so what it should have cost all along is what an
 * ordinary request costs. There is no new number to configure and no new number
 * to get wrong.
 *
 * A refused handshake is answered by engine.io as 403, which the client treats
 * as a connection error and retries with its own backoff — the same shape a
 * client already has to survive when the server restarts.
 */

/** Storage is shared with the HTTP counters, so the name keeps them apart. */
const THROTTLER_NAME = 'ws-handshake';

/** What socket.io calls before it accepts a connection. */
export type AllowRequest = (
  request: IncomingMessage,
  respond: (error: string | null, allowed: boolean) => void,
) => void;

export function handshakeThrottle(storage: ThrottlerStorage): AllowRequest {
  return (request, respond) => {
    storage
      .increment(
        keyFor(clientAddressOf(request)),
        GLOBAL_WINDOW,
        GLOBAL_LIMIT,
        GLOBAL_WINDOW,
        THROTTLER_NAME,
      )
      .then(({ isBlocked }) =>
        isBlocked
          ? respond('Too many connection attempts', false)
          : respond(null, true),
      )
      .catch(() =>
        // A counter that cannot answer must not be what keeps people out: the
        // storage is in memory, so this only happens if something worse is
        // already wrong.
        respond(null, true),
      );
  };
}

/**
 * The address the HTTP counters would have used.
 *
 * Only the reverse proxy publishes a port and it appends the real client to
 * `X-Forwarded-For`, so the **last** hop is what Express hands `req.ip` under
 * `trust proxy: 1` (see `main.ts`). Taking the first entry instead would let a
 * caller choose their own bucket by writing the header; ignoring the header
 * would count every client behind the proxy as one.
 */
function clientAddressOf(request: IncomingMessage): string {
  const forwarded = request.headers['x-forwarded-for'];
  const chain = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
  const lastHop = chain?.split(',').at(-1)?.trim();
  return lastHop || request.socket?.remoteAddress || 'unknown';
}

/** Hashed for the same reason the recipient counter hashes: keys outlive requests. */
function keyFor(address: string): string {
  return createHash('sha256')
    .update(`${THROTTLER_NAME}:${address}`)
    .digest('hex');
}
