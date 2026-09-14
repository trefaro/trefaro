import {
  Inject,
  Injectable,
  UseInterceptors,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerStorage,
  minutes,
} from '@nestjs/throttler';
import { REGISTRATION_PAYLOAD_PART } from '@trefaro/shared-models';
import { createHash } from 'node:crypto';
import type { Observable } from 'rxjs';
import { RATE_LIMITS } from '../config/env.module';
import type { RateLimitEnv } from '../config/rate-limits';

/**
 * The second counter of phase 5: mails per **recipient**, not per caller.
 *
 * Every public route that sends a mail is a way to put a message in somebody
 * else's inbox, and until now all four counters guarding them counted the
 * client address — which the sender picks. One machine behind a handful of
 * proxies could therefore mail one victim as often as it liked, and no limit in
 * this repository would have noticed. This one counts the address in the body,
 * across every route that carries it, so the budget belongs to the inbox.
 *
 * **An interceptor and not a guard, deliberately.** Guards run before anything
 * has parsed a body, and the registration form submits `multipart/form-data`
 * whenever it has a file field — a guard would see an empty body there and wave
 * the request through, which is a bypass an attacker only has to find once.
 * Declared *after* the multipart interceptor, this one runs with the parsed
 * body in hand, whichever of the two shapes it arrived in.
 *
 * What it does not do is hide anything: an exhausted budget answers 429, the
 * same refusal the counter next to it gives. That is a decision and not an
 * oversight — the alternative, accepting the request and quietly dropping the
 * mail, would leak nothing but would also leave a household that shares one
 * address with no way to find out why the confirmation link never arrived. The
 * residual signal is narrow: a caller can learn that *somebody* used this
 * address within the last five minutes, never that it is registered here
 * (E10, E32, E45 are about the persistent fact, and this is not it).
 */
@Injectable()
export class RecipientThrottleInterceptor implements NestInterceptor {
  constructor(
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
    @Inject(RATE_LIMITS) private readonly limits: RateLimitEnv,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const address = recipientOf(context.switchToHttp().getRequest().body);

    if (address) {
      const { isBlocked } = await this.storage.increment(
        keyFor(address),
        WINDOW,
        this.limits.mailsPerRecipientPerWindow,
        WINDOW,
        THROTTLER_NAME,
      );
      if (isBlocked) {
        // Deliberately the same wording the caller-side limit uses: the answer
        // should not tell a stranger which of the two counters they ran into.
        throw new ThrottlerException();
      }
    }
    return next.handle();
  }
}

/**
 * Counts a route's recipients (see {@link RecipientThrottleInterceptor}).
 *
 * Where a route also parses multipart, this has to come **after** the multipart
 * interceptor in the same `@UseInterceptors` call — interceptors run in the
 * order they are declared, and the body is only parsed once the first one has
 * done its work.
 */
export const ThrottleByRecipient = (): MethodDecorator & ClassDecorator =>
  UseInterceptors(RecipientThrottleInterceptor);

/** The same five minutes every other limit counts over. */
const WINDOW = minutes(5);

/** Storage is shared with the guard's counters, so the name keeps them apart. */
const THROTTLER_NAME = 'recipient';

/**
 * The address a request would send a mail to, or `null` if there is none to
 * read.
 *
 * Two shapes, because the registration endpoint accepts two: plain JSON, and a
 * multipart submission whose fields travel as JSON in one part. A body this
 * cannot read is not refused — an address that is missing or malformed is the
 * validator's business, and refusing it here would answer 429 where the caller
 * deserves a 400.
 */
function recipientOf(body: unknown): string | null {
  if (!isRecord(body)) return null;

  const direct = body['email'];
  if (typeof direct === 'string') return normalise(direct);

  const payload = body[REGISTRATION_PAYLOAD_PART];
  if (typeof payload !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    return isRecord(parsed) && typeof parsed['email'] === 'string'
      ? normalise(parsed['email'])
      : null;
  } catch {
    return null;
  }
}

function normalise(address: string): string | null {
  return address.trim().toLowerCase() || null;
}

/**
 * Hashed, so the counter does not keep a list of addresses in memory for five
 * minutes after every sign-up. No route in the key: one inbox, one budget,
 * however many forms lead to it.
 */
function keyFor(address: string): string {
  return createHash('sha256')
    .update(`${THROTTLER_NAME}:${address}`)
    .digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
