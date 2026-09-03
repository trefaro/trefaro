import { expect, test } from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
import { waitForMailTo } from './support/mail';
import {
  PAST_EVENT,
  PUBLISHED_SERIES,
  UPCOMING_EVENT,
} from './support/series-fixtures';

/**
 * Writing to the organizers without an account (FR 3.4, UC 14, F11) — AP 9.
 *
 * The acceptance criterion of the package as a participant meets it: somebody
 * who has just found the organization asks a question on the page they landed
 * on, without an account and without a login, and the organization learns
 * about it in its mailbox. Both halves are here, because either one alone
 * proves nothing — a form that answers "thank you" and sends no mail looks the
 * same from the browser.
 *
 * Read out of Mailpit like the double opt-in is, and matched by the **body**:
 * the notification's recipient is the organization, so three browser engines
 * running against one instance all write to the same mailbox with the same
 * subject. The unique address in the message is what tells them apart.
 *
 * No clean-up of its own: a contact request hangs off its event
 * (`FK_conversation_event ON DELETE CASCADE`), and the global teardown removes
 * the seeded series with everything under it. Nothing here creates a
 * registration, so nothing pins that series (E14).
 */
const LANDING_PAGE = `/series/${PUBLISHED_SERIES.slug}/events/${UPCOMING_EVENT.slug}`;
const PAST_PAGE = `/series/${PUBLISHED_SERIES.slug}/events/${PAST_EVENT.slug}`;

test.describe('contacting the organizers from an event page', () => {
  test('sends a question without an account and reaches the mailbox', async ({
    page,
  }, testInfo) => {
    const email = `e2e-${testInfo.project.name}-${Date.now()}@contact.example.org`;
    const question = `E2E is the venue accessible? (${testInfo.project.name})`;

    await page.goto(LANDING_PAGE);

    // On the landing page itself, in a named region: no login, no navigation,
    // no second page to find.
    const form = page.getByRole('region', { name: t('contact.title') });
    await expect(form).toBeVisible();
    await expectNoRawKeys(page);

    await form
      .getByLabel(t('contact.name'), { exact: false })
      .fill('E2E Guest');
    await form.getByLabel(t('contact.email'), { exact: false }).fill(email);
    await form
      .getByLabel(t('contact.message'), { exact: false })
      .fill(question);
    await form.getByRole('button', { name: t('contact.submit') }).click();

    // What the answer has to say is where the answer will arrive (F11).
    await expect(form.getByText(email, { exact: false })).toBeVisible();
    // And the form is gone, so nobody sends the same question twice.
    await expect(
      form.getByRole('button', { name: t('contact.submit') }),
    ).toBeHidden();

    const mail = await waitForMailTo(PUBLISHED_SERIES.contactEmail, {
      text: new RegExp(email.replace(/[.+]/g, '\\$&')),
    });
    expect(mail.subject).toContain(UPCOMING_EVENT.name);
    expect(mail.text).toContain('E2E Guest');
    expect(mail.text).toContain(question);
  });

  test('is still there for an event that is over', async ({ page }) => {
    await page.goto(PAST_PAGE);

    // Unlike the call to action, which is gone once an event has ended: "where
    // is the recording" is a question about something that has happened.
    await expect(
      page.getByRole('region', { name: t('contact.title') }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: t('event.register') }),
    ).toBeHidden();
  });

  test('sends nothing until the question is complete', async ({ page }) => {
    await page.goto(LANDING_PAGE);
    const form = page.getByRole('region', { name: t('contact.title') });

    await form
      .getByLabel(t('contact.name'), { exact: false })
      .fill('E2E Guest');
    await form.getByRole('button', { name: t('contact.submit') }).click();

    // Still the form, not a thank-you: the browser's own validation names the
    // field that is missing, and nothing was sent.
    await expect(
      form.getByRole('button', { name: t('contact.submit') }),
    ).toBeVisible();
  });
});
