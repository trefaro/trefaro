import { randomBytes } from 'node:crypto';
import { CHECKIN_CODE_LENGTH } from '@trefaro/shared-models';

/**
 * Crockford's base32 alphabet: no `I`, no `L`, no `O`, no `U`.
 *
 * Chosen for the half of FR 3.16 that has no camera in it (F199). A code that
 * gets typed at a door — because a phone is flat, a screen is cracked or the
 * light is wrong — must not have two characters that look alike in it, and
 * dropping the vowel `U` keeps a random string from spelling something at the
 * worst possible moment.
 *
 * Exactly 32 characters, which is what makes `byte % 32` uniform: 256 divides
 * evenly, so there is no modulo bias to reject samples for.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * A fresh, opaque admission code (E53).
 *
 * **Not the self-service token.** That one is signed, carries a subject and a
 * purpose, and can cancel a registration (F44, F148); this one carries nothing
 * at all. It is a random string that exists in a row, and what it proves is
 * that the row exists — which is exactly as much as a paper ticket proves.
 *
 * Twenty-six characters of the alphabet above is 130 bits. Guessing one is not
 * a threat model anybody has to reason about, and the code stays short enough
 * to read out loud.
 *
 * Stored rather than derived, and that is not a contradiction of F23: there the
 * subject is the record of a **consent**, here it is an admission ticket. A
 * derived code would be a signature under another name, and rotating
 * `AUTH_SECRET` would invalidate every ticket in every pocket at the venue.
 */
export function newCheckinCode(): string {
  const bytes = randomBytes(CHECKIN_CODE_LENGTH);
  let code = '';
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

/**
 * What a scan sends, in the spelling the column holds.
 *
 * Trimmed and upper-cased, because the two ways a code arrives disagree about
 * both: a camera hands over exactly what is in the QR code, and a person types
 * with a space at the end and the caps lock off. Normalizing at the door rather
 * than storing two spellings — the column holds one, and a lookup that had to
 * try several would be a lookup that cannot use the unique index.
 */
export function normalizeCheckinCode(code: string): string {
  return code.trim().toUpperCase();
}
