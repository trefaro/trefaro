import { expect, test } from '@playwright/test';
import {
  confirmationPathFrom,
  registrationIdFromPath,
  waitForMailTo,
} from './support/mail';
import { removeRegistrations } from './support/registration-clean-up';
import {
  PAST_EVENT,
  PUBLISHED_SERIES,
  UPCOMING_EVENT,
} from './support/series-fixtures';

/**
 * Registering for an event in a browser (UC 07, FR 3.5, E5b).
 *
 * The whole double opt-in, through the parts a participant actually touches: the
 * landing page's call to action, the form, the mail, and the page the link in it
 * points at. The mail is read out of Mailpit, because a confirmation flow that is
 * only asserted inside the server has not been shown to work.
 *
 * Each browser registers under its own address — three engines run this spec
 * against one instance, and one address registers once per event (E10).
 */
const CLIENT_URL =
  process.env['BASE_URL'] ?? process.env['CLIENT_URL'] ?? 'http://localhost:4200';

const LANDING_PAGE = `/series/${PUBLISHED_SERIES.slug}/events/${UPCOMING_EVENT.slug}`;

/** Removed after the run: a confirmed registration would pin its series (E14). */
const created: string[] = [];

test.afterAll(async () => {
  await removeRegistrations(CLIENT_URL, created);
  created.length = 0;
});

test.describe('registering for an event', () => {
  test('registers, confirms by mail, and reports a second click as already confirmed', async ({
    page,
  }, testInfo) => {
    const email = `e2e-${testInfo.project.name}-${Date.now()}@registrations.example.org`;

    await page.goto(LANDING_PAGE);
    await page.getByRole('link', { name: 'Register now' }).click();

    await expect(page).toHaveURL(/\/register$/);
    await page.getByLabel('First name').fill('E2E');
    await page.getByLabel('Last name').fill('Participant');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Phone').fill('+49 221 123456');
    await page.getByLabel('Where are you coming from?').fill('Cologne');
    await page.getByRole('button', { name: 'Register' }).click();

    // Nothing is registered yet, and the page says so rather than congratulating.
    await expect(page.getByRole('heading', { name: 'Almost done' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    const mail = await waitForMailTo(email);
    expect(mail.subject).toContain(UPCOMING_EVENT.name);
    const confirmationPath = confirmationPathFrom(mail);
    created.push(registrationIdFromPath(confirmationPath));

    // A click, not the mere opening of the link: a mail scanner that prefetches
    // links must not be able to confirm anything (E5b).
    await page.goto(confirmationPath);
    await page.getByRole('button', { name: 'Confirm my registration' }).click();
    await expect(
      page.getByRole('heading', { name: 'Your registration is confirmed' }),
    ).toBeVisible();
    await expect(page.getByText(UPCOMING_EVENT.name)).toBeVisible();

    await page.goto(confirmationPath);
    await page.getByRole('button', { name: 'Confirm my registration' }).click();
    await expect(
      page.getByRole('heading', {
        name: 'This registration was already confirmed',
      }),
    ).toBeVisible();
  });

  test('does not send anything without the mandatory fields', async ({
    page,
  }) => {
    await page.goto(`${LANDING_PAGE}/register`);
    await page.getByLabel('First name').fill('Nameless');

    await page.getByRole('button', { name: 'Register' }).click();

    // FR 3.5 makes first name, last name and e-mail mandatory; the form must not
    // post a half-filled registration.
    await expect(
      page.getByRole('heading', { name: 'Almost done' }),
    ).toBeHidden();
  });

  test('refuses a token that does not hold up', async ({ page }) => {
    await page.goto(
      '/registrations/confirm?token=bm90LWEtdG9rZW4.bm90LWEtc2lnbmF0dXJl',
    );
    await page.getByRole('button', { name: 'Confirm my registration' }).click();

    await expect(page.getByRole('alert')).toContainText('not valid');
  });

  test('offers no registration on an event that is over', async ({ page }) => {
    await page.goto(`/series/${PUBLISHED_SERIES.slug}/events/${PAST_EVENT.slug}`);

    await expect(page.getByText('This event has ended')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register now' })).toBeHidden();
  });
});
