/**
 * What a mail is made of (FR 3.5, NFR 4).
 *
 * Until AP 10 of phase 2 this file declared one interface per language and a
 * file implementing it, which made a missing translation a compile error. The
 * text now lives in the catalogue the organization maintains (E22), so that
 * guarantee could not survive — a catalogue is data, and no compiler reads it.
 * What replaces it is two things: the key list a template declares here, checked
 * against the shipped English catalogue in CI, and E24 at runtime, which sends
 * the whole mail in English rather than half of it in German.
 */

import type { MailStrings } from './strings';

export interface RenderedMail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** The event a mail is about, in the form a template needs it. */
export interface MailEvent {
  readonly name: string;
  /** Absolute instants; the template renders them in `timezone` (E8). */
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string;
  /** Absolute URL of the public landing page. */
  readonly url: string;
}

export interface RegistrationMailContext {
  readonly firstName: string;
  readonly event: MailEvent;
}

export interface ConfirmationMailContext extends RegistrationMailContext {
  /** Where the participant confirms — a page, not the API (E5b). */
  readonly confirmUrl: string;
}

/**
 * The receipt, which is also where self-service begins (E11).
 *
 * The personal link is only in this message and not in the confirmation
 * request: before the address is confirmed there is nothing to self-serve, and a
 * link that granted sign-ups before the double opt-in would make the opt-in
 * decorative.
 */
export interface ReceiptMailContext extends RegistrationMailContext {
  /**
   * "My registration" for this one registration, valid until thirty days after
   * the event (E11). Re-issued whenever this mail is sent again, so "I lost the
   * link" is answered by submitting the registration form once more.
   */
  readonly selfServiceUrl: string;
}

/**
 * The double opt-in for a participant account (FR 4.1, E32).
 *
 * No event: an account belongs to the person and not to an event, which is the
 * same reason the profile field kit is instance-wide (E35). The only mail in
 * this application that says nothing about a date.
 */
export interface ProfileConfirmationMailContext {
  readonly firstName: string;
  /** Where the participant confirms — a page, not the API (E5b). */
  readonly confirmUrl: string;
}

/**
 * What is sent when somebody registers an address that already has an account.
 *
 * The counterpart to E32 on the outgoing side: the form answers the same way
 * whether the address was known or not, so the difference has to be in the
 * message — which only its recipient reads. It carries no token, because there
 * is nothing to authorize; re-sending it is harmless by construction.
 */
export interface ProfileExistsMailContext {
  readonly firstName: string;
  /** The login page of the participant client. */
  readonly loginUrl: string;
}

/**
 * An invitation to former participants of a series (FR 2.4, F24).
 *
 * The organizer writes `subject` and the paragraphs; the template writes
 * everything around them — the greeting, the event block, and the footer that
 * says why this mail arrived and how to stop the next one. That division is the
 * point: the organizer's words go out unchanged, and the parts E15 requires
 * cannot be forgotten, because they are not the organizer's to write.
 *
 * `paragraphs` arrive already split (`invitationParagraphs` in `shared-models`),
 * so the preview in the organizer client and the mail cut the text the same way.
 * They are plain text and are escaped here: nothing an organizer types becomes
 * markup in somebody's mail client.
 */
export interface InvitationMailContext {
  readonly firstName: string;
  /** Named in the footer: why this address is being written to at all. */
  readonly seriesName: string;
  readonly subject: string;
  readonly paragraphs: readonly string[];
  /** The event invited to, when the invitation names one. */
  readonly event: MailEvent | null;
  /** Where the recipient objects — a page, not the API (E5b, F58). */
  readonly optOutUrl: string;
}

/**
 * One mail: the words it needs, and how it puts them together.
 *
 * The two travel as one value because E24 asks a question about a *mail* — "does
 * this language have every piece of this letter?" — and a key list kept beside
 * the renderer instead of in it is a list that drifts. `keys` is therefore the
 * unit of the whole-mail fallback and, at the same time, what CI checks the
 * shipped catalogue against.
 */
export interface MailTemplate<Context> {
  /** For the log line that says what went out, and for tests to name. */
  readonly name: string;
  /** Every catalogue key {@link render} may ask for. */
  readonly keys: readonly string[];
  render(strings: MailStrings, context: Context): RenderedMail;
}
