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

/**
 * Changing one's own password as an organizer (AP 9 of phase 5).
 *
 * The same two fields the participant's change has, and deliberately the same
 * shape rather than a shared type: the two accounts are different subjects
 * with different tables and different cookies (E33, E34), and one type used by
 * both would be the first place somebody wired one side's form to the other's
 * endpoint.
 *
 * There is no reset beside it, and that is a decision rather than an omission.
 * A reset link is a mail to an address, and the address of an organizer is the
 * one this instance sends *from* — the security review of AP 9 says why in
 * `docs/SECURITY-REVIEW.md`.
 */
export interface AdminPasswordChange {
  readonly currentPassword: string;
  readonly newPassword: string;
}
