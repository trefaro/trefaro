/**
 * Reads the mail the server sent, from Mailpit.
 *
 * A slim reader rather than the one in `apps/server-e2e`: Nx keeps the two e2e
 * projects apart, and only two things are needed here — the newest message to an
 * address, and the link inside it.
 *
 * Mailpit is part of the development stack (`infra/docker-compose.dev.yml`) and
 * a service container in CI. Without it this suite cannot prove the one thing
 * the double opt-in is about: that a working link actually reached an inbox.
 */
const MAILPIT_URL = process.env['MAILPIT_URL'] ?? 'http://127.0.0.1:8025';

interface MailpitSummary {
  ID: string;
  Subject: string;
  To: readonly { Address: string }[];
}

export interface CapturedMail {
  readonly subject: string;
  readonly text: string;
}

/**
 * The newest message to `address`, waiting briefly for it to be indexed.
 *
 * `subject` narrows it, which matters wherever an address receives more than one
 * message: an invitation (FR 2.4) arrives after the two mails of the double
 * opt-in, and it arrives *later* than the request that triggered it, because the
 * sending happens in the background (F56). Without the pattern the wait would
 * end immediately on the receipt that is already there.
 */
export async function waitForMailTo(
  address: string,
  options: { timeoutMs?: number; subject?: RegExp } = {},
): Promise<CapturedMail> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const deadline = Date.now() + timeoutMs;

  let lastError = '';

  while (Date.now() < deadline) {
    // A refused connection counts as "not there yet": in CI the service
    // container and the browsers start at the same time.
    const response = await fetch(
      `${MAILPIT_URL}/api/v1/messages?limit=200`,
    ).catch((error: unknown) => {
      lastError = error instanceof Error ? error.message : String(error);
      return null;
    });
    if (!response?.ok) {
      lastError = lastError || `status ${response?.status}`;
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }
    const { messages = [] } = (await response.json()) as {
      messages?: MailpitSummary[];
    };
    const summary = messages.find(
      (mail) =>
        mail.To.some(
          (recipient) =>
            recipient.Address.toLowerCase() === address.toLowerCase(),
        ) &&
        (!options.subject || options.subject.test(mail.Subject)),
    );

    if (summary) {
      const body = (await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${summary.ID}`)
      ).json()) as { Text?: string };
      return { subject: summary.Subject, text: body.Text ?? '' };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `No mail for ${address}${
      options.subject ? ` matching ${options.subject}` : ''
    } arrived within ${timeoutMs / 1000}s` +
      (lastError
        ? `. Mailpit at ${MAILPIT_URL} was not reachable (${lastError}) — start it with ` +
          '`docker compose -f infra/docker-compose.dev.yml up -d mailpit`.'
        : '.'),
  );
}

/**
 * The confirmation link from a mail, as a path the test can navigate to.
 *
 * Returned relative so Playwright's `baseURL` decides the host: the server puts
 * its own configured client URL in the mail, and in a test run that is not
 * necessarily the address the browser reaches the client on.
 */
export function confirmationPathFrom(mail: CapturedMail): string {
  const match = /https?:\/\/[^\s]*\/registrations\/confirm\?token=[^\s]+/.exec(
    mail.text,
  );
  if (!match) {
    throw new Error(`No confirmation link in "${mail.subject}"`);
  }
  const url = new URL(match[0]);
  return `${url.pathname}${url.search}`;
}

/**
 * The account confirmation link from the mail (FR 4.1, E5b), as a path.
 *
 * Its own matcher rather than a parameter on the one above: the two links go to
 * two different pages, and a regular expression that took the path as an
 * argument would let a caller ask for a page that does not exist. Relative for
 * the reason the others are — the server writes its own configured client URL
 * into the mail, and that need not be the address the browser uses.
 */
export function accountConfirmationPathFrom(mail: CapturedMail): string {
  const match = /https?:\/\/[^\s]*\/profile\/confirm\?token=[^\s]+/.exec(
    mail.text,
  );
  if (!match) {
    throw new Error(`No account confirmation link in "${mail.subject}"`);
  }
  const url = new URL(match[0]);
  return `${url.pathname}${url.search}`;
}

/**
 * The personal self-service link from the receipt (E11), as a path.
 *
 * Relative for the same reason as the confirmation path above: the server puts
 * its own configured client URL in the mail, which need not be the address the
 * browser reaches the client on.
 */
/**
 * The objection link from an invitation (E15, F58), as a path.
 *
 * Relative for the same reason as the two above. That every invitation carries
 * one is not an assumption: the template writes it, not the organizer, so this
 * function throwing means the promise E15 makes has been broken.
 */
export function optOutPathFrom(mail: CapturedMail): string {
  const match =
    /https?:\/\/[^\s]*\/invitations\/unsubscribe\?token=[^\s]+/.exec(mail.text);
  if (!match) {
    throw new Error(`No objection link in "${mail.subject}"`);
  }
  const url = new URL(match[0]);
  return `${url.pathname}${url.search}`;
}

export function selfServicePathFrom(mail: CapturedMail): string {
  const match = /https?:\/\/[^\s]*\/registrations\/me\?token=[^\s]+/.exec(
    mail.text,
  );
  if (!match) {
    throw new Error(`No personal link in "${mail.subject}"`);
  }
  const url = new URL(match[0]);
  return `${url.pathname}${url.search}`;
}
