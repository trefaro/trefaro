import type { CustomFieldValues } from './field';

/**
 * Registering for an event with double opt-in (FR 3.5, UC 07).
 *
 * The second highest rated function of the survey (3,69). Phase 1 has no
 * participant login, so a registration is identified by its e-mail address and
 * everything a participant may do afterwards travels on a signed link (E5, E11).
 */

/**
 * Where a registration stands.
 *
 * `pending` means the address has not been confirmed yet: it is a claim, not a
 * participant. Only `confirmed` counts towards a head count, and only a
 * confirmed registration may be contacted about later events (E15).
 * `cancelled` is kept rather than deleted so the seat is demonstrably free
 * without the record vanishing (E14).
 */
export type RegistrationStatus = 'pending' | 'confirmed' | 'cancelled';

export const REGISTRATION_STATUSES: readonly RegistrationStatus[] = [
  'pending',
  'confirmed',
  'cancelled',
];

/**
 * What a participant fills in (FR 3.5, mockups 5.4).
 *
 * Mandatory: first name, last name, e-mail. Phone and origin are asked for
 * because organizers need them for visa letters and travel planning, but an
 * event that does not need them must not turn them into a barrier.
 */
export interface RegistrationInput {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone?: string | null;
  /** Free text: country, city or organization — the organizer decides what to ask. */
  readonly origin?: string | null;
  readonly newsletterOptIn?: boolean;
  /**
   * Answers to the fields this event defines (F12).
   *
   * Keyed by field key. Validated against the definitions rather than against a
   * fixed shape, and an unknown key is refused instead of dropped: a typo in a
   * key would otherwise cost an answer without anybody noticing.
   */
  readonly customFields?: CustomFieldValues;
}

/**
 * The answer to a registration attempt — deliberately the same in every case.
 *
 * It says nothing about whether the address was already registered (E10): a
 * form that answered differently would turn the public registration page into a
 * way to query the participant list, which for an organization whose events are
 * political is a real risk, not a theoretical one.
 */
export interface RegistrationAcknowledgement {
  /** Echoed back so the client can name the inbox to look in. */
  readonly email: string;
}

/** Whether this click confirmed the registration or found it already confirmed. */
export type ConfirmationState = 'confirmed' | 'already-confirmed';

/** The result of following a confirmation link (E5b). */
export interface RegistrationConfirmation {
  readonly state: ConfirmationState;
  readonly eventName: string;
  /** Both slugs, so the confirmation page can link back to the event. */
  readonly seriesSlug: string;
  readonly eventSlug: string;
}
