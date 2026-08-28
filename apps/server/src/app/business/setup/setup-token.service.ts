import { Injectable } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 bytes: brute force is not a threat model, so it needs no rate limit. */
const SETUP_TOKEN_BYTES = 32;

/**
 * The one-off secret that lets somebody claim a fresh instance (E28).
 *
 * A fresh instance answers on its port the moment `docker compose up` returns,
 * and the routes that create the first administrator cannot require a session —
 * there is nobody to be. Without a secret the instance would belong to whoever
 * reached it first, which on a public host is a race the operator does not know
 * they are in.
 *
 * The token is generated in memory and never stored: the operator has the log,
 * because the operator started the container. A restart issues a new one, which
 * is the right behaviour — an abandoned setup should not leave a working key
 * lying around, and there is nothing to clean up afterwards.
 *
 * `timingSafeEqual` rather than `===`: comparing secrets with an early-exit
 * comparison leaks their prefix through response time. Not because guessing a
 * 256-bit token is plausible, but because the habit is what keeps the next
 * comparison safe.
 */
@Injectable()
export class SetupTokenService {
  private token: string | null = null;

  /** Issues the token once; later calls return the same one. */
  issue(): string {
    this.token ??= randomBytes(SETUP_TOKEN_BYTES).toString('base64url');
    return this.token;
  }

  /** Whether a token was issued at all — false on an instance already set up. */
  isIssued(): boolean {
    return this.token !== null;
  }

  matches(candidate: unknown): boolean {
    if (this.token === null || typeof candidate !== 'string') return false;

    const expected = Buffer.from(this.token, 'utf8');
    const actual = Buffer.from(candidate, 'utf8');
    // Length is not a secret, and `timingSafeEqual` throws on a mismatch.
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  /**
   * Forgets the token, once it has done its work.
   *
   * The setup route answers 404 from the moment an administrator exists, so this
   * is not what closes it — it keeps a spent secret from sitting in memory for
   * the lifetime of the process.
   */
  discard(): void {
    this.token = null;
  }
}
