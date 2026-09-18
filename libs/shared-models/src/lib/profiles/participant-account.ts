import type { CustomFieldValues } from '../registrations';

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

/**
 * Where the participant client shows the registration form.
 *
 * Named here for the same reason as the login: a mail links to it. Somebody who
 * asks to reset the password of an address that has no account is written to —
 * that is where E32's unvarying answer puts the difference — and the one useful
 * thing such a letter can offer is the form that would create the account.
 */
export const PROFILE_REGISTRATION_PATH = '/profile/register';

/**
 * Where somebody says they have forgotten their password.
 *
 * Linked from the login form and from the mail that answers a repeated
 * registration (E32) — which may now say what it could not before phase 5:
 * that there is a way back in.
 */
export const PROFILE_FORGOT_PASSWORD_PATH = '/profile/forgot-password';

/**
 * Where the mailed reset link lands, with its token in the query.
 *
 * A page and not the API, like every other link this application mails (E5b):
 * a scanner that prefetches links must not be able to spend the one token that
 * hands an account over, and a person clicking it deserves a form rather than a
 * status code.
 */
export const PROFILE_NEW_PASSWORD_PATH = '/profile/new-password';

/** A participant as they see themselves; never carries the password hash. */
export interface ParticipantAccount {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  /** BCP 47 tag: the language this person is written to and rendered in. */
  readonly preferredLocale: string;
  /**
   * Public URL of the profile picture, or `null` for a profile without one.
   *
   * Carries no stored path and a `?v=` that moves when the picture does — the
   * same construction as a series or event logo (F113), for the same reason:
   * the neighbours of a stored path are registration attachments (E9).
   */
  readonly avatarUrl: string | null;
  /**
   * What this person works on, as free text (E36, FR 4.3).
   *
   * Its own field rather than a question in the field kit, because FR 4.4
   * filters the participant search on it — a search criterion buried in
   * `custom_fields_json` is not one that can be compared reliably.
   */
  readonly activityAreas: string | null;
  /** The answers to the instance's profile questions, by field key (E35). */
  readonly customFields: CustomFieldValues;
  /**
   * Whether this profile may be found by other participants (F13, E37).
   *
   * Off unless the person switches it on, and it is the opt-in for **being
   * contacted** as well: a one-to-one conversation can only start with a
   * profile that is in the search. One switch, one meaning.
   */
  readonly searchable: boolean;
  /** ISO 8601 — when the address was confirmed. Never null here. */
  readonly confirmedAt: string;
}

/**
 * What the profile form sends to `PATCH /api/participant/me` (FR 4.3).
 *
 * Partial at the top level: an absent property is one the form did not touch.
 * `customFields`, though, is whole when it is there — the answers are checked
 * against the definitions as a set, because "required" is a property of the
 * form and can only be judged on a complete submission (E35).
 *
 * The address is deliberately not here. It is the identity (E31), the
 * registrations of this person are found by it, and changing it would cut the
 * history rather than carry it along.
 */
export interface ParticipantProfileUpdate {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly preferredLocale?: string;
  /** An empty string means "no longer stated", not the empty answer. */
  readonly activityAreas?: string | null;
  readonly customFields?: CustomFieldValues;
  readonly searchable?: boolean;
}

/**
 * Changing the password from inside the profile (FR 4.3).
 *
 * With the current one, which is what makes this a change rather than a reset:
 * a reset is its own route with its own token, its own lifetime and its own
 * non-disclosing answer, and it is not part of FR 4.3.
 */
export interface ParticipantPasswordChange {
  readonly currentPassword: string;
  readonly newPassword: string;
}

/**
 * What the "delete my account" form posts (E65).
 *
 * The current password, and nothing else. It is the same guard the password
 * change has and it is there for the same reason: whoever is holding this
 * session may have found the screen unlocked, and of everything a session can
 * do, this is the one thing that cannot be taken back. No second field, no
 * typed-out confirmation word — a checkbox or a phrase to copy is a hurdle,
 * not proof, and the proof already exists.
 */
export interface ParticipantAccountDeletion {
  readonly password: string;
}

/**
 * What the "I have forgotten my password" form posts (E10, E32).
 *
 * An address and nothing else. No name, no old password, no question to answer:
 * everything that decides whether anything happens is on the server, and
 * anything else on this form would be a field that cannot be checked.
 */
export interface PasswordResetRequest {
  readonly email: string;
}

/**
 * The answer to that form — the same answer every time.
 *
 * It carries the address back, exactly like a registration acknowledgement, and
 * for the same reason: whether that address has an account, has an unconfirmed
 * one, or has none at all is the difference a public form may not tell
 * (E10, E32). Every one of the three sends a letter, so the answer takes the
 * same time as well, which is the half of non-disclosure that a status code
 * alone does not cover.
 */
export interface PasswordResetAcknowledgement {
  readonly email: string;
}

/**
 * What the page behind the mailed link posts to set the new password.
 *
 * The token travels in the body rather than in the query, like every other
 * token that *changes* something (F44): a link previewer fetching the address
 * must not be able to set somebody's password. The page has it from its own
 * query and hands it on.
 */
export interface PasswordReset {
  readonly token: string;
  readonly password: string;
}

/** What the avatar upload and removal endpoints answer with. */
export interface AvatarImage {
  readonly avatarUrl: string | null;
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
