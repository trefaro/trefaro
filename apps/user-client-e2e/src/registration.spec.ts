import { expect, test } from '@playwright/test';
import { confirmationPathFrom, waitForMailTo } from './support/mail';
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
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4200';

const LANDING_PAGE = `/series/${PUBLISHED_SERIES.slug}/events/${UPCOMING_EVENT.slug}`;

/**
 * Addresses this run registered, removed again afterwards.
 *
 * A confirmed registration would otherwise pin its series for good (E14).
 */
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
    created.push(email);

    await page.goto(LANDING_PAGE);
    await page.getByRole('link', { name: 'Register now' }).click();

    await expect(page).toHaveURL(/\/register$/);
    await page.getByLabel('First name').fill('E2E');
    await page.getByLabel('Last name').fill('Participant');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Phone').fill('+49 221 123456');
    await page.getByLabel('Where are you coming from?').fill('Cologne');

    // The configurable fields of this event (F12) — one per type, built from the
    // definitions the fixture seeded rather than written into the template.
    await page.getByLabel('Dietary requirements').fill('No nuts, please');
    await expect(
      page.getByText('So the caterer knows what to plan for.'),
    ).toBeVisible();
    await page.getByLabel('Meal *').selectOption('Vegan');
    await page.getByLabel('I have read the code of conduct *').check();
    // The file field (E9). The hint says what the form takes before the picker
    // is opened, because a rejected file after a long upload is the worst way to
    // learn about a limit.
    await expect(page.getByText('PDF, up to 1.0 MB')).toBeVisible();
    await page.getByLabel('Passport scan *').setInputFiles({
      name: 'Reisepass.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nnot a real passport\n'),
    });

    await page.getByRole('button', { name: 'Register' }).click();

    // Nothing is registered yet, and the page says so rather than congratulating.
    await expect(
      page.getByRole('heading', { name: 'Almost done' }),
    ).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    const mail = await waitForMailTo(email);
    expect(mail.subject).toContain(UPCOMING_EVENT.name);
    const confirmationPath = confirmationPathFrom(mail);

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

  test('does not send anything while a required question is unanswered', async ({
    page,
  }, testInfo) => {
    await page.goto(`${LANDING_PAGE}/register`);
    await page.getByLabel('First name').fill('Unanswered');
    await page.getByLabel('Last name').fill('Participant');
    await page
      .getByLabel('E-mail')
      .fill(
        `e2e-unanswered-${testInfo.project.name}@registrations.example.org`,
      );
    // The optional question is answered; the three required ones are not.
    await page.getByLabel('Dietary requirements').fill('Nothing special');

    await page.getByRole('button', { name: 'Register' }).click();

    // The browser half of the acceptance criterion of AP 6. The server refuses
    // the same registration with 400, which the API contract suite asserts —
    // this is the courtesy that keeps the participant from finding out by mail
    // that nothing happened.
    await expect(
      page.getByRole('heading', { name: 'Almost done' }),
    ).toBeHidden();
  });

  test('says why a file cannot be sent, before it is sent', async ({
    page,
  }, testInfo) => {
    await page.goto(`${LANDING_PAGE}/register`);
    await page.getByLabel('First name').fill('Wrong');
    await page.getByLabel('Last name').fill('Filetype');
    await page
      .getByLabel('E-mail')
      .fill(`e2e-filetype-${testInfo.project.name}@registrations.example.org`);
    await page.getByLabel('Meal *').selectOption('Vegan');
    await page.getByLabel('I have read the code of conduct *').check();

    await page.getByLabel('Passport scan *').setInputFiles({
      name: 'holiday.png',
      mimeType: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });

    // A courtesy, not the rule — the server checks the type and the bytes
    // themselves. But it is the difference between an explanation and a form
    // that seems not to react.
    await expect(page.getByRole('alert')).toContainText('takes PDF');

    await page.getByRole('button', { name: 'Register' }).click();
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
    await page.goto(
      `/series/${PUBLISHED_SERIES.slug}/events/${PAST_EVENT.slug}`,
    );

    await expect(page.getByText('This event has ended')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register now' })).toBeHidden();
  });
});
