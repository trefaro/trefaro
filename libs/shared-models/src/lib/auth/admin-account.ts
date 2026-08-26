/**
 * An administrator of the instance, as both the server and the organizer client
 * see them (FR 1.2, FR 1.3).
 *
 * Never carries the password hash. Timestamps are ISO 8601 strings, because
 * that is what survives JSON — the client turns them into dates where it needs
 * to render them.
 */
export interface AdminAccount {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly createdAt: string;
  /** `null` for an account that has never been used. */
  readonly lastLoginAt: string | null;
}

/** What the organizer client posts to `POST /api/admin/auth/login`. */
export interface AdminLoginRequest {
  readonly email: string;
  readonly password: string;
}

/** What a successful login answers: who is now logged in, and until when. */
export interface AdminSessionInfo {
  readonly admin: AdminAccount;
  /** ISO 8601 — the client can warn before an idle session lapses. */
  readonly expiresAt: string;
}
