/**
 * Reads the mail the server actually sent.
 *
 * Mailpit stands in for the organization's SMTP server: it is part of the
 * development stack (`infra/docker-compose.dev.yml`) and a service container in
 * CI, and it accepts everything and delivers nothing. Asserting against it is
 * the difference between "the code called a mailer" and "a message with a
 * working link left the server" — which is the whole point of a double opt-in.
 */
const MAILPIT_URL = process.env['MAILPIT_URL'] ?? 'http://127.0.0.1:8025';

interface MailpitSummary {
  ID: string;
  Subject: string;
  To: readonly { Address: string }[];
}

export interface CapturedMail {
  readonly id: string;
  readonly subject: string;
  readonly to: readonly string[];
  readonly text: string;
  readonly html: string;
}

/** Waits for Mailpit to answer; the CI service container starts in parallel. */
export async function waitForMailpit(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'never attempted';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=1`);
      if (response.ok) return;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await pause(500);
  }

  throw new Error(
    `Mailpit did not answer at ${MAILPIT_URL} within ${timeoutMs / 1000}s (last: ${lastError}). ` +
      'Start it with `docker compose -f infra/docker-compose.dev.yml up -d mailpit`.',
  );
}

export async function clearMailbox(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
}

/**
 * The newest message to `address`, waiting for it to arrive.
 *
 * The server awaits the SMTP handover before it answers, so the message is
 * normally already there — the wait covers Mailpit's own indexing, not a queue.
 */
export async function waitForMailTo(
  address: string,
  timeoutMs = 10_000,
): Promise<CapturedMail> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const found = await findMailTo(address);
    if (found) return found;
    await pause(250);
  }

  throw new Error(`No mail for ${address} arrived within ${timeoutMs / 1000}s`);
}

/** How many messages Mailpit currently holds for an address. */
export async function countMailTo(address: string): Promise<number> {
  const summaries = await list();
  return summaries.filter((mail) => addressed(mail, address)).length;
}

/** The `token` query parameter of the first confirmation link in a message. */
export function confirmationTokenFrom(mail: CapturedMail): string {
  const match = /registrations\/confirm\?token=([A-Za-z0-9_.%-]+)/.exec(
    mail.text,
  );
  if (!match) {
    throw new Error(`No confirmation link in "${mail.subject}"`);
  }
  return decodeURIComponent(match[1]);
}

/**
 * The `token` of the personal self-service link in a message (E11).
 *
 * Only the receipt carries one — the confirmation request deliberately does not,
 * because before the address is confirmed there is nothing to self-serve.
 */
export function selfServiceTokenFrom(mail: CapturedMail): string {
  const match = /registrations\/me\?token=([A-Za-z0-9_.%-]+)/.exec(mail.text);
  if (!match) {
    throw new Error(`No self-service link in "${mail.subject}"`);
  }
  return decodeURIComponent(match[1]);
}

/**
 * The `token` of the objection link in an invitation (E15, F58).
 *
 * Every invitation carries one, written by the template rather than by the
 * organizer — so a message without this link is a bug, and this helper throwing
 * is the test that says so.
 */
export function optOutTokenFrom(mail: CapturedMail): string {
  const match = /invitations\/unsubscribe\?token=([A-Za-z0-9_.%-]+)/.exec(
    mail.text,
  );
  if (!match) {
    throw new Error(`No objection link in "${mail.subject}"`);
  }
  return decodeURIComponent(match[1]);
}

async function findMailTo(address: string): Promise<CapturedMail | null> {
  const summary = (await list()).find((mail) => addressed(mail, address));
  if (!summary) return null;

  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${summary.ID}`);
  const body = (await response.json()) as { Text?: string; HTML?: string };
  return {
    id: summary.ID,
    subject: summary.Subject,
    to: summary.To.map((recipient) => recipient.Address),
    text: body.Text ?? '',
    html: body.HTML ?? '',
  };
}

async function list(): Promise<readonly MailpitSummary[]> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=200`);
  const body = (await response.json()) as { messages?: MailpitSummary[] };
  return body.messages ?? [];
}

function addressed(mail: MailpitSummary, address: string): boolean {
  return mail.To.some(
    (recipient) => recipient.Address.toLowerCase() === address.toLowerCase(),
  );
}

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
