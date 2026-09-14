/**
 * What a reset token says, and how it stops saying it (E5, AP 4 of phase 5).
 *
 * A reset link has to work **once**, and the tokens of this application store
 * nothing — so there is no row to tick off. The answer is to sign a subject
 * that is only true while the password is the one the link was minted against:
 * the account id, and a keyed mark of its password hash
 * (`TokenSigner.mark`). Setting a password changes the hash, the mark of the
 * new hash differs, and every link minted against the old one stops resolving
 * to an account. So does a password *changed* in the profile meanwhile, which
 * is the same statement about the same account and the right outcome.
 *
 * What this costs, said out loud: asking for a second link does not invalidate
 * the first, because both are minted against the same hash. Whichever is used
 * first spends both.
 */

/** Neither a UUID nor base64url contains it, so it can separate the two. */
const SEPARATOR = '.';

export interface ResetSubjectParts {
  readonly profileId: string;
  /** `TokenSigner.mark` of the password hash this link was minted against. */
  readonly passwordMark: string;
}

export function resetSubject(profileId: string, passwordMark: string): string {
  return `${profileId}${SEPARATOR}${passwordMark}`;
}

/**
 * Reads a subject back, or `null` for anything this module did not write.
 *
 * Strict about the shape on purpose: the only other thing that could arrive
 * here is a subject signed for one of the five other purposes, and those carry
 * a bare id. A reader that shrugged at a missing mark would accept a token that
 * was never minted against a password — which is the whole mechanism.
 */
export function resetSubjectParts(subject: string): ResetSubjectParts | null {
  const parts = subject.split(SEPARATOR);
  if (parts.length !== 2) return null;

  const [profileId, passwordMark] = parts;
  if (!profileId || !passwordMark) return null;

  return { profileId, passwordMark };
}
