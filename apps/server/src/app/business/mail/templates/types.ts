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

export interface MailTemplates {
  /** BCP 47 tag this set is written in, so a caller can log what it sent. */
  readonly locale: string;
  /** Asks the participant to confirm their address (double opt-in). */
  registrationConfirmation(context: ConfirmationMailContext): RenderedMail;
  /** The receipt afterwards: confirmed, what you signed up for, and the link. */
  registrationConfirmed(context: ReceiptMailContext): RenderedMail;
}
