import type { ResolvedSession } from '../../common/resolved-session';
import type { UserProfileRecord } from './user-profile.repository';

/**
 * Port for participant sessions (E34).
 *
 * Rows rather than self-contained tokens, for the same reason the
 * administrative sessions are: a deleted profile has to lose its sessions at
 * once, and a signed token would stay valid until it expired.
 *
 * Only the SHA-256 hash of the session token is stored: a stolen database dump
 * must not hand over live sessions.
 */
export interface NewUserSession {
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

/** Which participant is behind the current request, and which session says so. */
export interface AuthenticatedParticipant extends ResolvedSession {
  readonly profile: UserProfileRecord;
}

export interface UserSessionRepository {
  create(session: NewUserSession): Promise<void>;
  /**
   * Resolves a session token hash to its owner, ignoring sessions that expired
   * at or before `now`. One query, so a request costs one round trip.
   */
  findActive(
    tokenHash: string,
    now: Date,
  ): Promise<AuthenticatedParticipant | null>;
  /** Slides the idle timeout forward for a session that is being used. */
  touch(sessionId: string, seenAt: Date, expiresAt: Date): Promise<void>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  /**
   * Ends every session of one account except the one asking (FR 4.3).
   *
   * Its caller is the password change, and it is the reason the method exists:
   * somebody who changes their password because they think a device is not
   * theirs any more has said something about the other sessions, not only about
   * the password. Their own session survives, so the screen they are looking at
   * does not log itself out.
   *
   * @returns how many were ended, for the log line — nobody is shown a count.
   */
  deleteForUserExcept(userId: string, keepSessionId: string): Promise<number>;
  /** Housekeeping — expired rows are dead weight, not a security problem. */
  deleteExpired(now: Date): Promise<number>;
}

export const USER_SESSION_REPOSITORY = Symbol(
  'TREFARO_USER_SESSION_REPOSITORY',
);
