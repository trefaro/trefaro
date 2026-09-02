import { createHash, randomBytes } from 'node:crypto';

/** 256 bits of randomness — the token is the only thing standing in the door. */
const SESSION_TOKEN_BYTES = 32;

/**
 * A fresh session token: the value that travels in a cookie, and nothing else.
 *
 * Shared by both session services since phase 3 (F100). Two kinds of session
 * exist — an organizer's (F22) and a participant's (E34) — and they differ in
 * which table they are written to and which cookie carries them, never in how
 * the secret is made or stored. A second implementation of these six lines is
 * how one of them ends up with a shorter token.
 */
export function newSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

/** The stored form of a session token. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
