import type { ResolvedSession } from '../../common/resolved-session';
import type { AdminUserRecord } from './admin-user.repository';

/**
 * Port for administrative sessions (F22).
 *
 * Sessions are rows rather than self-contained tokens because FR 1.2 allows
 * deleting an administrator, and that has to end their running sessions at once
 * — a signed token would stay valid until it expired.
 *
 * Only the SHA-256 hash of the session token is stored: a stolen database dump
 * must not hand over live sessions.
 */
export interface NewAdminSession {
  readonly adminUserId: string;
  readonly tokenHash: string;
  readonly userAgent: string | null;
  readonly expiresAt: Date;
}

/** Who is behind the current request, and which session says so. */
export interface AuthenticatedAdmin extends ResolvedSession {
  readonly admin: AdminUserRecord;
}

export interface AdminSessionRepository {
  create(session: NewAdminSession): Promise<void>;
  /**
   * Resolves a session token hash to its owner, ignoring sessions that expired
   * at or before `now`. One query, so a request costs one round trip.
   */
  findActive(tokenHash: string, now: Date): Promise<AuthenticatedAdmin | null>;
  /** Slides the idle timeout forward for a session that is being used. */
  touch(sessionId: string, seenAt: Date, expiresAt: Date): Promise<void>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  /**
   * Ends every session of one administrator but the one asking (AP 9).
   *
   * The twin of `UserSessionRepository.deleteForUserExcept`, and it exists for
   * the same reason: somebody who changes their password because a device is
   * not theirs any more has said something about that device, not only about
   * the password. The session they are looking at survives, so the screen does
   * not log itself out while it reports success.
   *
   * There is no `deleteForAdmin` beside it, unlike on the participant side:
   * an organizer's account has no reset link and no way to lose every session
   * at once except being deleted, and that already ends them — `admin_session`
   * hangs on `admin_user` with `ON DELETE CASCADE`.
   *
   * @returns how many were ended, for the log line — nobody is shown a count.
   */
  deleteForAdminExcept(
    adminUserId: string,
    keepSessionId: string,
  ): Promise<number>;
  /** Housekeeping — expired rows are dead weight, not a security problem. */
  deleteExpired(now: Date): Promise<number>;
}

export const ADMIN_SESSION_REPOSITORY = Symbol(
  'TREFARO_ADMIN_SESSION_REPOSITORY',
);
