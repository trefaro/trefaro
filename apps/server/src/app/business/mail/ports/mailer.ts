/**
 * Port for handing a finished message to the outside world.
 *
 * The business layer composes mail; something else delivers it. That split is
 * what lets every test assert on what would have been sent without an SMTP
 * server anywhere near it — and it keeps the choice of transport a single
 * binding in the mail module rather than a dependency of every caller.
 */

export interface OutgoingMail {
  readonly to: string;
  readonly subject: string;
  /** Always both parts: a text-only client must not receive an empty message. */
  readonly text: string;
  readonly html: string;
}

export interface Mailer {
  /** @throws when the message could not be handed over. */
  send(mail: OutgoingMail): Promise<void>;
}

export const MAILER = Symbol('TREFARO_MAILER');
