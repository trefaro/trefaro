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

/** The newest message to `address`, waiting briefly for it to be indexed. */
export async function waitForMailTo(
  address: string,
  timeoutMs = 15_000,
): Promise<CapturedMail> {
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
    const summary = messages.find((mail) =>
      mail.To.some(
        (recipient) =>
          recipient.Address.toLowerCase() === address.toLowerCase(),
      ),
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
    `No mail for ${address} arrived within ${timeoutMs / 1000}s` +
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
