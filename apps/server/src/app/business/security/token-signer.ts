import { Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';

/**
 * What a token authorizes.
 *
 * Part of the signed payload and checked on verification, so a confirmation
 * link can never be replayed as a self-service link — the two have different
 * lifetimes and grant different things. A confirmation link is spent in a day
 * and confirms one address; a self-service link lives as long as the event does
 * and speaks for the registration the whole time (E11).
 */
export type TokenPurpose =
  | 'registration-confirmation'
  | 'registration-self-service'
  | 'invitation-opt-out'
  /** The double opt-in of a participant account (FR 4.1, E32). */
  | 'profile-confirmation'
  /**
   * The double opt-in of a newsletter sign-up (FR 4.8, E45).
   *
   * Its subject is the id of the `newsletter_subscription` row, so a token
   * cannot confirm an address other than the one that was signed up — and
   * cannot be replayed as any of the four purposes above it, which is what
   * having a purpose in the payload is for.
   */
  | 'newsletter-confirmation';

/** Fourteen days, per E5: long enough for someone who registers before a holiday. */
export const CONFIRMATION_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * How long a self-service link outlives its event (E11).
 *
 * Thirty days after the event ends: long enough to look up what one attended and
 * to give up a seat in the last session, short enough that a forwarded mail from
 * two conferences ago grants nothing. Phase 3 puts the participant login in front
 * of the same page and lets these links keep working.
 */
export const SELF_SERVICE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The lifetime of a self-service token for an event ending at `eventEndsAt`.
 *
 * Never zero or negative: a link into a past event still has to be *readable*,
 * or somebody who confirmed on the last day would receive a mail whose link was
 * dead on arrival. What the link can still change is decided by the rules on
 * each action, not by the token's lifetime.
 */
export function selfServiceTokenTtlMs(eventEndsAt: Date | string): number {
  const endsAt = new Date(eventEndsAt).getTime();
  const until =
    (Number.isFinite(endsAt) ? endsAt : Date.now()) + SELF_SERVICE_GRACE_MS;
  return Math.max(SELF_SERVICE_GRACE_MS, until - Date.now());
}

/**
 * How long the objection link in an invitation stays usable (E15, F58).
 *
 * Two years, which is long for a signed token and deliberately so: this is the
 * link that lets somebody stop being written to, and a dead one would turn the
 * promise of E15 into a promise the organization cannot keep. It is also the
 * least dangerous link this application mints — the only thing it can do is
 * *reduce* what happens to its holder.
 *
 * Rotating `AUTH_SECRET` invalidates it like every other token. That is the one
 * case where an organization has to be able to say "reply to this mail", which
 * is why the invitation templates name the organizer's address as well.
 */
export const INVITATION_OPT_OUT_TTL_MS = 2 * 365 * 24 * 60 * 60 * 1000;

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
    return createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
  }

  /** Constant-time comparison, so a signature cannot be guessed byte by byte. */
  private matches(payload: string, provided: string): boolean {
    const expected = Buffer.from(this.signature(payload), 'utf8');
    const actual = Buffer.from(provided, 'utf8');
    // `timingSafeEqual` throws on differing lengths; a length mismatch is a
    // mismatch, and the length of a hash of a known input is not a secret.
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
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
