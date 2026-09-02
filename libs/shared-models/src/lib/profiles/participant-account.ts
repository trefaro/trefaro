/**
 * The participant's own account (FR 4.1, FR 4.2, FR 4.3).
 *
 * An account is an address (E31): `email` is the identity of the person across
 * the whole instance, it is what their registrations are found by, and it is the
 * one field the profile cannot change — a new address is a new person as far as
 * the history of an event is concerned.
 */
export const PROFILES_MODULE_KEY = 'profiles';

/**
 * Where the participant client confirms a new account.
 *
 * The link in the mail points at a page, not at the API (E5b): a mail scanner
 * that prefetches links must not be able to confirm an address, and the person
 * clicking it deserves an answer they can read. Shared with the server so the
 * page and the mail cannot drift apart.
 */
export const PROFILE_CONFIRMATION_PATH = '/profile/confirm';

/**
 * Where the participant client shows the login form.
 *
 * Named here because a mail links to it: the message sent when somebody tries
 * to register an address that already has an account points at the login rather
 * than at a token (E32) — there is nothing to authorize, only somewhere to go.
 */
export const PROFILE_LOGIN_PATH = '/profile/login';

/** A participant as they see themselves; never carries the password hash. */
export interface ParticipantAccount {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  /** BCP 47 tag: the language this person is written to and rendered in. */
  readonly preferredLocale: string;
  /** ISO 8601 — when the address was confirmed. Never null here. */
  readonly confirmedAt: string;
}

/** What the participant client posts to `POST /api/participant/auth/login`. */
export interface ParticipantLoginRequest {
  readonly email: string;
  readonly password: string;
}

/** What a successful participant login answers: who, and until when. */
export interface ParticipantSessionInfo {
  readonly participant: ParticipantAccount;
  /** ISO 8601 — the client can warn before an idle session lapses. */
  readonly expiresAt: string;
}

/** What the registration form posts to `POST /api/user/profiles`. */
export interface ProfileRegistrationRequest {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  /**
   * The language the form was filled in, so the confirmation mail arrives in it.
   * Optional: an omitted tag means the instance's default language.
   */
  readonly preferredLocale?: string;
}

/**
 * The answer to a registration attempt — the same answer every time (E32).
 *
 * It carries the address back and nothing else. Whether that address was
 * unknown, waiting for confirmation or long since in use is deliberately not in
 * here: the difference is what turns a public form into a query for who has an
 * account, and for an organization running political events that is a real risk
 * (E10). What differs is the mail that goes out, and only its recipient sees it.
 */
export interface ProfileRegistrationAcknowledgement {
  readonly email: string;
}

/**
 * What `POST /api/user/profiles/confirm` answers.
 *
 * Idempotent like the registration confirmation (E5b): people click a link
 * twice, and a second click reports what is already true instead of failing.
 */
export interface ProfileConfirmation {
  readonly state: 'confirmed' | 'already-confirmed';
  /** So the page can greet the person it just let in. */
  readonly firstName: string;
}
