/**
 * The instance's relationship with its mail server: what it insists on, how
 * fast it talks, and what it says when one of those is loosened.
 *
 * Until phase 5 this was four values and one assumption. The assumption was
 * that whatever the organization configured would be good enough — the
 * connection was encrypted if `SMTP_SECURE` said so, and otherwise it was
 * not, with nothing in between and nothing said about it. That is the gap
 * E62 closes: a submission server on port 587 does not start encrypted, it
 * *upgrades*, and an upgrade nobody insists on is an upgrade a network can
 * quietly take away.
 *
 * Hence {@link SmtpEnv.requireTls}, and hence the rule that goes with it:
 * a certificate is trusted by naming it (`NODE_EXTRA_CA_CERTS`), never by
 * switching the check off. There is no variable in this file for that, and
 * there is no line in this repository that does it — {@link smtpWarnings}
 * exists partly to say so out loud when the process environment does it
 * behind the code's back.
 */

/** Everything the instance knows about where its mail goes. */
export interface SmtpEnv {
  readonly host: string;
  readonly port: number;
  /**
   * Encrypted from the first byte — implicit TLS, conventionally port 465.
   *
   * Not the same as {@link requireTls} and not a superset of it in spelling
   * only: with this on, there is no unencrypted phase for anything to be
   * stripped from, so a server that cannot do it fails the connection rather
   * than quietly continuing in the clear.
   */
  readonly secure: boolean;
  /**
   * STARTTLS or nothing — for the ports that begin unencrypted (587, 25).
   *
   * The default is `true` in production and `false` everywhere else, which is
   * the one place in this file where the environment decides a value. The
   * reason is the development stack: its Mailpit has no certificate, and a
   * default that made `nx serve` unable to send mail would be a default
   * somebody switches off once and forgets. In production the direction
   * reverses — there, handing mail over in the clear is the thing that has to
   * be asked for.
   */
  readonly requireTls: boolean;
  readonly user: string | null;
  readonly password: string | null;
  /** Envelope sender for all outgoing mail (double opt-in, organizer replies). */
  readonly from: string;
  /**
   * How long a sender waits between two messages, in milliseconds.
   *
   * Only one sender sends messages in a row — the invitation sender (F56) —
   * and this is the number that keeps two hundred of them from arriving at a
   * small mail server as a burst. A shared mail service that sees two hundred
   * messages in twenty seconds does not thank the sender for being quick; it
   * throttles it, and in the worse case it blacklists the domain the
   * organization also receives its own mail on.
   */
  readonly pauseBetweenMailsMs: number;
}

export const SMTP_DEFAULTS = {
  /**
   * One second, so two hundred invitations take three minutes.
   *
   * The number is chosen from the failure it prevents rather than from
   * throughput: `todo.md` named "two hundred invitations in twenty seconds" as
   * the way an instance gets itself throttled, so the default has to make that
   * impossible rather than merely slower. An organizer watching the counters
   * sees them move the whole time, which is the part that matters for F56 —
   * nobody is waiting on a request.
   */
  pauseBetweenMailsMs: 1000,
} as const;

/** What an instance is, as far as its mail server is concerned. */
export interface SmtpContext {
  readonly production: boolean;
  /**
   * Whether `NODE_TLS_REJECT_UNAUTHORIZED=0` is in the process environment.
   *
   * Read in `main.ts` rather than here: it is not this application's
   * configuration, it is Node's, and it is in this file only because it
   * undoes what the rest of it is for.
   */
  readonly certificateChecksDisabled: boolean;
}

/**
 * What the instance should say out loud while starting, given its mail setup.
 *
 * The same shape as `rateLimitWarnings`, and for the same reason: what gets
 * announced is the setting that was made *less* careful than the shipped one,
 * so silence is honest and a line is a decision somebody made. Encrypting more
 * than required is never a warning.
 */
export function smtpWarnings(smtp: SmtpEnv, context: SmtpContext): string[] {
  const warnings: string[] = [];
  const encrypted = smtp.secure || smtp.requireTls;

  // First, because it makes every other line here meaningless: a process that
  // accepts any certificate has no encrypted connection it can vouch for.
  if (context.certificateChecksDisabled) {
    warnings.push(
      'NODE_TLS_REJECT_UNAUTHORIZED is 0 — this process accepts any TLS ' +
        'certificate from any server, which makes an encrypted connection ' +
        'worth about as much as an unencrypted one. A mail server with a ' +
        'certificate of its own is trusted by naming it in NODE_EXTRA_CA_CERTS ' +
        '(E62), never by switching the check off.',
    );
  }

  if (smtp.user && !encrypted) {
    // The sharper of the two, and it holds in every environment: there is no
    // setup in this repository where a password is meant to go out in the clear.
    warnings.push(
      `SMTP_USER is set while SMTP_SECURE and SMTP_REQUIRE_TLS are both off — ` +
        `the mail server password travels to ${smtp.host}:${smtp.port} in the ` +
        'clear, and so does every message behind it (E62).',
    );
  } else if (context.production && !encrypted) {
    warnings.push(
      `SMTP_REQUIRE_TLS is off — this instance hands its mail to ${smtp.host}:` +
        `${smtp.port} unencrypted. That is a defensible choice for a mail ` +
        'server on the same host and nowhere else (E62).',
    );
  }

  if (smtp.pauseBetweenMailsMs < SMTP_DEFAULTS.pauseBetweenMailsMs) {
    warnings.push(
      `SMTP_PAUSE_BETWEEN_MAILS_MS is ${smtp.pauseBetweenMailsMs}, below the ` +
        `default of ${SMTP_DEFAULTS.pauseBetweenMailsMs} — an invitation to two ` +
        'hundred people then reaches the mail server faster than anyone asked ' +
        'it whether it minds.',
    );
  }

  return warnings;
}
