/**
 * The shape every language has to fill (FR 3.5, NFR 4).
 *
 * One file per locale implements `MailTemplates`, which makes a missing
 * translation a compile error rather than a mail that silently goes out in
 * English. Phase 2 lets an organization maintain its own languages; adding one
 * before that is a file plus a line in the registry, with no change here.
 */

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

export interface MailTemplates {
  /** BCP 47 tag this set is written in, so a caller can log what it sent. */
  readonly locale: string;
  /** Asks the participant to confirm their address (double opt-in). */
  registrationConfirmation(context: ConfirmationMailContext): RenderedMail;
  /** The receipt afterwards: confirmed, and here is what you signed up for. */
  registrationConfirmed(context: RegistrationMailContext): RenderedMail;
}
