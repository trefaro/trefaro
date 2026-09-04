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
 * The double opt-in of a newsletter sign-up made in the app (FR 4.8, E45).
 *
 * The ninth mail, and the second one that greets nobody — for the opposite
 * reason to the contact notification, which goes to a mailbox rather than to a
 * person. This one goes to a person whose name the instance does not know and
 * has no business asking for: a newsletter address is an address (F42).
 *
 * `seriesName` is what the sign-up was about, or `null` for the whole
 * instance, and it is resolved in the language the letter turned out to be
 * written in (F125) like every other translated value in a mail.
 *
 * The "if this was not you" line is not decoration. This mail is sent to an
 * address a public form accepted, so it may reach somebody who never asked for
 * anything — and until the link is clicked, nothing has happened. Saying so is
 * the difference between a confirmation and an unsolicited letter.
 */
export interface NewsletterConfirmationMailContext {
  /** Where the sign-up is confirmed — a page, not the API (E5b). */
  readonly confirmUrl: string;
  /** The series this sign-up is about, or `null` for the instance. */
  readonly seriesName: string | null;
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
 * A question from somebody without an account, on its way to the organization
 * (FR 3.4, UC 14 — E39, F11).
 *
 * The only mail of this application whose recipient is the organization rather
 * than a participant, and the only one that carries words a **stranger** wrote.
 * Both facts shape it:
 *
 * - `paragraphs` are the guest's own text, escaped here like an organizer's
 *   invitation is — nothing anybody types becomes markup in a mail client.
 * - `guestEmail` is in the letter because that is where the answer goes (F11).
 *   It is also the reason this mail exists at all: without it the organization
 *   would have to poll the message overview to notice a question.
 *
 * There is no `firstName` and no greeting. Every other mail is addressed to a
 * person who can be greeted by name; this one arrives in a shared mailbox, and
 * "Hello Democracy International" is a robot addressing an organization by its
 * own name.
 */
export interface ContactRequestMailContext {
  /** The event whose landing page carried the form. */
  readonly event: MailEvent;
  readonly guestName: string;
  /** Where the answer goes — the address the guest typed, unverified. */
  readonly guestEmail: string;
  /** What they wrote, already split into paragraphs. */
  readonly paragraphs: readonly string[];
  /** Where the organization reads and answers it — the organizer client. */
  readonly answerUrl: string;
}

/**
 * The organizer's answer to a question from somebody without an account
 * (FR 3.4, F11, F174).
 *
 * The other half of {@link ContactRequestMailContext}, and the mail that makes
 * F11 true: an interested person with no account is answered **by mail**, and
 * the same words stay in the conversation the organizer answered from.
 *
 * `guestName` is the name they typed into the form, which is why this mail
 * greets and the notification does not: it goes to a person, not to a shared
 * mailbox. `paragraphs` are the organizer's own text, already split the way
 * an invitation's are, and escaped here for the same reason.
 *
 * No URL of its own. The event block links the page the question was asked on,
 * and that page is also where the next one can be asked — a second address
 * would be a promise about a mailbox somebody has to read.
 */
export interface ContactAnswerMailContext {
  readonly guestName: string;
  /** The event the question was about. */
  readonly event: MailEvent;
  /** What the organizer wrote, already split into paragraphs. */
  readonly paragraphs: readonly string[];
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
