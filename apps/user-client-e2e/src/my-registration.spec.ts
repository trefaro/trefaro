import { expect, test, type Page } from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
import { selfServicePathFrom, waitForMailTo } from './support/mail';
import { removeRegistrations } from './support/registration-clean-up';
import {
  PROGRAM_ITEMS,
  PUBLISHED_SERIES,
  UPCOMING_EVENT,
} from './support/series-fixtures';

/**
 * "My registration" in a browser (FR 3.10, E11) — AP 9.
 *
 * The page a participant reaches without an account: the personal link in the
 * confirmation receipt. The link is read out of Mailpit rather than minted here,
 * because the one thing about E11 that could quietly not work is the link
 * actually leaving the server and pointing at a page that exists.
 *
 * What is asserted here and not in the API contract suite: the sessions are
 * rendered in the venue's zone (E8) — the runner's own zone is UTC, so a page
 * that read the reader's clock would be visibly out — and the buttons are the
 * ones the state calls for.
 *
 * Each browser engine registers under its own address: three of them run against
 * one instance, and one address registers once per event (E10). The session they
 * all sign up for therefore has no seat limit; that a full one refuses the next
 * sign-up is proven where seats can be counted without a race.
 *
 * Three registrations per engine and no more. Each one costs two mails and a
 * confirmation, and the confirmation endpoint is rate limited on purpose (E4) —
 * so the display assertions share one participant instead of asking for a fresh
 * one per expectation.
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4200';

const REGISTER_PATH =
  `/api/user/series/${PUBLISHED_SERIES.slug}` +
  `/events/${UPCOMING_EVENT.slug}/registrations`;

const FIELDS_PATH =
  `/api/user/series/${PUBLISHED_SERIES.slug}` +
  `/events/${UPCOMING_EVENT.slug}/registration-fields`;

/** The session that asks who is coming, and one that does not. */
const TOUR = PROGRAM_ITEMS[3].title;
const KEYNOTE = PROGRAM_ITEMS[0].title;

interface PublicField {
  key: string;
  type: 'text' | 'select' | 'checkbox' | 'file';
  options: string[];
  required: boolean;
}

const created: string[] = [];

test.afterAll(async () => {
  await removeRegistrations(CLIENT_URL, created);
  created.length = 0;
});

/**
 * Registers and confirms through the API, and opens the personal page.
 *
 * Through the API rather than through the form: the form is what
 * `registration.spec.ts` is about, and repeating it here would make every test
 * in this file depend on it. The mail, though, is real — that is the part under
 * test.
 *
 * The event's own questions (F12) are answered from their definitions rather
 * than from a literal, including the required file field (E9): the fixture's
 * form is the organizer client's business, and a suite that hard-coded its
 * fields would break the next time somebody adds one.
 */
async function openMyRegistration(page: Page, email: string): Promise<void> {
  created.push(email);

  const registered = await page.request.post(REGISTER_PATH, {
    ...(await submission(page, email)),
  });
  expect(`${registered.status()} ${await registered.text()}`).toMatch(/^202/);

  const request = await waitForMailTo(email);
  const confirmPath = new URL(
    `http://localhost${
      /\/registrations\/confirm\?token=[^\s]+/.exec(request.text)?.[0] ?? ''
    }`,
  );
  const confirmed = await page.request.post('/api/user/registrations/confirm', {
    data: { token: confirmPath.searchParams.get('token') },
  });
  expect(`${confirmed.status()} ${await confirmed.text()}`).toMatch(/^200/);

  // The receipt is the newer message, and the only one with a personal link.
  await page.goto(selfServicePathFrom(await waitForMailTo(email)));
}

/**
 * One valid submission for this event, as JSON or as multipart.
 *
 * Multipart only when the form actually asks for a file (F39): the payload then
 * travels as JSON in its own part, and each file in a part named after its
 * field key.
 */
async function submission(
  page: Page,
  email: string,
): Promise<{ data: unknown } | { multipart: Record<string, unknown> }> {
  const fields: PublicField[] = await (
    await page.request.get(FIELDS_PATH)
  ).json();
  const customFields: Record<string, unknown> = {};
  const files: Record<string, unknown> = {};

  for (const field of fields.filter((entry) => entry.required)) {
    switch (field.type) {
      case 'select':
        customFields[field.key] = field.options[0];
        break;
      case 'checkbox':
        // A required checkbox has to be ticked, not merely answered (F36).
        customFields[field.key] = true;
        break;
      case 'file':
        files[field.key] = {
          name: 'e2e.pdf',
          mimeType: 'application/pdf',
          // The first bytes have to match the claimed type (F38).
          buffer: Buffer.from('%PDF-1.7\nnot a real document\n'),
        };
        break;
      default:
        customFields[field.key] = 'E2E';
    }
  }

  const payload = {
    firstName: 'Amina',
    lastName: 'Okonkwo',
    email,
    customFields,
  };

  return Object.keys(files).length === 0
    ? { data: payload }
    : { multipart: { payload: JSON.stringify(payload), ...files } };
}

const address = (what: string, project: string): string =>
  `e2e-me-${what}-${project}-${Date.now()}@registrations.example.org`;

const session = (page: Page, title: string) =>
  page
    .getByRole('region', { name: t('event.program') })
    .getByRole('listitem')
    .filter({ hasText: title });

test.describe('my registration', () => {
  test('shows my own details and the programme in the venue’s clock', async ({
    page,
  }, testInfo) => {
    const email = address('own', testInfo.project.name);

    await openMyRegistration(page, email);

    await expect(
      page.getByRole('heading', { name: t('mine.title'), level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('Amina Okonkwo')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    // Its own event, linked back to where the registration began.
    await expect(
      page.getByRole('link', { name: UPCOMING_EVENT.name }),
    ).toBeVisible();
    // And the warning that comes with not having a login yet.
    await expect(page.getByText(t('mine.keepLink'))).toBeVisible();
    // Every key on the page resolved: this is the screen with the most of them,
    // and one that renders as itself is what a missing translation looks like.
    await expectNoRawKeys(page);

    const programme = page.getByRole('region', { name: t('event.program') });
    await expect(
      programme.getByRole('heading', { name: KEYNOTE }),
    ).toBeVisible();
    // The fixture starts at 08:00 UTC in Europe/Berlin, so 09:00 or 10:00 at the
    // venue depending on the season. The runner's own zone is UTC: a page that
    // rendered the reader's clock would show 08:00 here (E8).
    await expect(
      programme.getByText(/\b(09|10):00–(10|11):00\b/).first(),
    ).toBeVisible();
    await expect(
      programme.getByRole('heading', { level: 3 }).first(),
    ).toContainText(/GMT\+[12]/);

    // Most sessions are simply attended: no seats, and no button that could only
    // be refused.
    await expect(session(page, KEYNOTE).getByRole('button')).toHaveCount(0);
  });

  test('claims a seat and gives it up again', async ({ page }, testInfo) => {
    await openMyRegistration(page, address('seat', testInfo.project.name));

    const tour = session(page, TOUR);
    await expect(
      tour.getByRole('button', { name: t('mine.signMeUp') }),
    ).toBeVisible();

    await tour.getByRole('button', { name: t('mine.signMeUp') }).click();

    await expect(
      session(page, TOUR).getByText(t('mine.seats.booked')),
    ).toBeVisible();

    await session(page, TOUR)
      .getByRole('button', { name: t('mine.giveUpSeat') })
      .click();

    await expect(
      session(page, TOUR).getByRole('button', { name: t('mine.signMeUp') }),
    ).toBeVisible();
  });

  test('says which part of the link is missing when there is no token', async ({
    page,
  }) => {
    await page.goto('/registrations/me');

    // A mail client that broke the link across two lines is the usual cause, so
    // the page names that rather than reporting an invalid link.
    await expect(page.getByRole('alert')).toHaveText(t('mine.noToken'));
  });

  test('cancels the registration, and the link then says so', async ({
    page,
  }, testInfo) => {
    await openMyRegistration(page, address('cancel', testInfo.project.name));
    const url = page.url();

    await session(page, TOUR)
      .getByRole('button', { name: t('mine.signMeUp') })
      .click();
    await expect(
      session(page, TOUR).getByText(t('mine.seats.booked')),
    ).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: t('mine.cancel') }).click();

    await expect(page.getByRole('status')).toHaveText(t('mine.cancelled'));
    // The seat went with it, and there is nothing left to claim.
    await expect(session(page, TOUR).getByRole('button')).toHaveCount(0);

    // And the link itself stops working, rather than quietly staying open on a
    // registration that no longer stands.
    await page.goto(url);
    // This client's own sentence, and the server's reason beside it (F77) —
    // "was cancelled" is the half no key of this client could say.
    const alert = page.getByRole('alert');
    await expect(alert).toContainText(t('mine.error.load'));
    await expect(alert).toContainText('was cancelled');
  });
});
