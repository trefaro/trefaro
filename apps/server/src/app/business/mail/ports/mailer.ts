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
  /**
   * Headers beyond the obvious ones, written by the template.
   *
   * Exactly one mail has any — the invitation, which carries the one-click
   * unsubscribe pair of RFC 8058 (F58). They are rendered where the body is
   * rendered on purpose: the header and the link in the footer point at the
   * same objection for the same person, and a header assembled somewhere else
   * would be free to disagree with the letter it travels on.
   */
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * The mail server said "not now" rather than "never".
 *
 * The distinction exists for one caller: the invitation sender, which works
 * through two hundred addresses and has to decide, per recipient, between
 * trying again and writing the attempt off (F56). Everywhere else a failure is
 * a failure — a double opt-in that cannot be handed over is a 503 whatever the
 * reason was.
 *
 * What counts as temporary is the transport's judgement, which is why this
 * lives at the port: over SMTP it is a 4xx reply, and a caller in the business
 * layer has no business knowing that a number between 400 and 499 means a full
 * mailbox or a greylisting server.
 */
export class TemporaryMailFailure extends Error {
  constructor(readonly cause: unknown) {
    super(
      cause instanceof Error
        ? cause.message
        : 'The mail server refused the message for now',
    );
    this.name = 'TemporaryMailFailure';
  }
}

export interface Mailer {
  /**
   * @throws TemporaryMailFailure when the message may be worth another attempt.
   * @throws when the message could not be handed over at all.
   */
  send(mail: OutgoingMail): Promise<void>;
}

export const MAILER = Symbol('TREFARO_MAILER');
