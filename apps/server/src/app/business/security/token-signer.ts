import { Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';

/**
 * What a token authorizes.
 *
 * Part of the signed payload and checked on verification, so a confirmation
 * link can never be replayed as a self-service link — the two have different
 * lifetimes and grant different things. AP 9 adds `registration-self-service`
 * (E11) and needs nothing but a second value here.
 */
export type TokenPurpose = 'registration-confirmation';

/** Fourteen days, per E5: long enough for someone who registers before a holiday. */
export const CONFIRMATION_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Separator inside the payload; neither a purpose nor a UUID contains it. */
const FIELD_SEPARATOR = '|';

/**
 * Signed, self-contained tokens for links that arrive by e-mail (E5).
 *
 * The token carries its own payload — purpose, subject and expiry — and an
 * HMAC over it. Nothing is stored, which is the point: a confirmation link is
 * not a session, it is a statement the server made and can recognize again.
 * What that buys, and what it costs:
 *
 * - No table, no cleanup job, and no way for a token to outlive its row.
 * - Changing `AUTH_SECRET` invalidates every link still in an inbox. Accepted
 *   deliberately: the alternative is a secret that can never be rotated.
 * - "Send it again" produces the same token rather than a second valid one.
 *
 * The signature is over the encoded payload, not the raw one, so no combination
 * of field values can be re-cut into a different but equally valid token.
 */
@Injectable()
export class TokenSigner {
  private readonly secret: string;

  constructor(@Inject(ENV) env: TrefaroEnv) {
    this.secret = env.authSecret;
  }

  /**
   * @param subject id of the record the token speaks for — a registration, say.
   * @param ttlMs how long it stays valid, from now.
   */
  sign(purpose: TokenPurpose, subject: string, ttlMs: number): string {
    const expiry = Date.now() + ttlMs;
    const payload = encode(
      [purpose, subject, String(expiry)].join(FIELD_SEPARATOR),
    );
    return `${payload}.${this.signature(payload)}`;
  }

  /**
   * The subject the token speaks for, or `null` if it does not hold up.
   *
   * `null` rather than an exception, and one `null` for every kind of failure:
   * a caller must not be able to tell a forged token from an expired one, and
   * the difference does not change what it can do about it.
   */
  verify(purpose: TokenPurpose, token: string): string | null {
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return null;

    const payload = token.slice(0, dot);
    if (!this.matches(payload, token.slice(dot + 1))) return null;

    const fields = decode(payload)?.split(FIELD_SEPARATOR);
    if (fields?.length !== 3) return null;

    const [signedPurpose, subject, expiry] = fields;
    if (signedPurpose !== purpose || !subject) return null;

    const expiresAt = Number(expiry);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

    return subject;
  }

  private signature(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }

  /** Constant-time comparison, so a signature cannot be guessed byte by byte. */
  private matches(payload: string, provided: string): boolean {
    const expected = Buffer.from(this.signature(payload), 'utf8');
    const actual = Buffer.from(provided, 'utf8');
    // `timingSafeEqual` throws on differing lengths; a length mismatch is a
    // mismatch, and the length of a hash of a known input is not a secret.
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

/** `null` when the input is not the base64url this class produced. */
function decode(value: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const decoded = Buffer.from(value, 'base64url').toString('utf8');
  return encode(decoded) === value ? decoded : null;
}
