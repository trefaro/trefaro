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
export interface AuthenticatedAdmin {
  readonly sessionId: string;
  readonly admin: AdminUserRecord;
  readonly lastSeenAt: Date;
  /** When the session lapses if it is not used again. */
  readonly expiresAt: Date;
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
  /** Housekeeping — expired rows are dead weight, not a security problem. */
  deleteExpired(now: Date): Promise<number>;
}

export const ADMIN_SESSION_REPOSITORY = Symbol(
  'TREFARO_ADMIN_SESSION_REPOSITORY',
);
