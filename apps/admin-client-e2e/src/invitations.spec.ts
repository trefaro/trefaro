import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STORAGE_STATE, fixtureLabel } from './support/admin-session';
import {
  PARTICIPANTS,
  closeFixtureDatabase,
  removeParticipants,
  seedParticipants,
  type SeededEvent,
} from './support/registration-fixtures';
import { t } from './support/catalogue';

/**
 * Inviting former participants in the browser (FR 2.4, E15) — AP 12.
 *
 * What only a browser can show, beyond the API contract suite that covers the
 * rules:
 *
 * - **The selection is a selection.** Ticking a box and pressing send has to
 *   reach exactly those people; the button says how many, which is the only
 *   feedback an organizer gets before two hundred mails go out.
 * - **There is no field for an address.** The page offers a list to pick from
 *   and nothing to type into — that is the visible half of F55.
 * - **The progress is watched.** The send answers before the mails are out
 *   (F56), so the log has to end up saying they went out without the organizer
 *   doing anything.
 *
 * The fixture is the participant overview's: a published series with one event
 * whose registrations are two confirmed, one pending and one cancelled. So the
 * filter of E15 is visible here rather than only asserted on a payload.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

const CONFIRMED = PARTICIPANTS.filter(
  (person) => person.status === 'confirmed',
);

test.describe('inviting former participants', () => {
  let seeded: SeededEvent;

  // `browserName` rather than an empty destructuring pattern: Playwright
  // requires the first argument to destructure its fixtures, and the engine's
  // name is what keeps three parallel runs from deriving the same slug.
  test.beforeEach(async ({ browserName }) => {
    seeded = await seedParticipants(fixtureLabel(browserName));
  });

  test.afterEach(async () => {
    if (seeded) await removeParticipants(seeded);
  });

  test.afterAll(async () => {
    await closeFixtureDatabase();
  });

  const open = (page: Page) =>
    page.goto(`/series/${seeded.seriesId}/invitations`);

  const who = (page: Page) =>
    page.getByRole('region', { name: t('admin.invitations.who') });
  const what = (page: Page) =>
    page.getByRole('region', { name: t('admin.invitations.what') });
  const log = (page: Page) =>
    page.getByRole('region', { name: t('admin.invitations.sentBefore') });

  test('is reachable from the series and lists only who may be written to', async ({
    page,
  }) => {
    await page.goto(`/series/${seeded.seriesId}`);
    await page
      .getByRole('link', { name: t('admin.invitations.title') })
      .click();

    await expect(
      page.getByRole('heading', { name: t('admin.invitations.title') }),
    ).toBeVisible();

    const rows = who(page).getByRole('row');
    // Two confirmed registrations out of twenty-eight rows: pending and
    // cancelled ones are not addresses this page may write to (E15).
    await expect(rows).toHaveCount(CONFIRMED.length + 1);
    await expect(who(page).getByText('Okonkwo, Amina')).toBeVisible();
    await expect(who(page).getByText('Zimmermann, Dieter')).toBeVisible();
    await expect(who(page).getByText('Adeyemi, Bruno')).toBeHidden();
    await expect(who(page).getByText('Okonkwo, Chiara')).toBeHidden();
  });

  test('shows the address itself in the table (E13)', async ({ page }) => {
    await open(page);

    await expect(
      who(page).getByText(/amina\.okonkwo\..*@participants\.example\.org/),
    ).toBeVisible();
  });

  test('offers no way to type an address (F55)', async ({ page }) => {
    await open(page);

    // The whole difference between this and a newsletter: every recipient comes
    // from the list.
    await expect(page.getByLabel(t('admin.invitations.email'))).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
  });

  test('says why an address may be missing, and how to stop being written to', async ({
    page,
  }) => {
    await open(page);

    await expect(
      page.getByText(/registered for an event of this series/),
    ).toBeVisible();
    await expect(page.getByText(/link to object/)).toBeVisible();
  });

  test('counts the selection in the button before anything is sent', async ({
    page,
  }) => {
    await open(page);

    const send = what(page).getByRole('button');
    await expect(send).toHaveText(t('admin.invitations.selectFirst'));
    await expect(send).toBeDisabled();

    await who(page).getByRole('checkbox').first().check();
    await expect(send).toHaveText(
      t('admin.invitations.sendTo.one', { count: 1 }),
    );
    await expect(send).toBeEnabled();
  });

  test('selects and clears the whole page with one button', async ({
    page,
  }) => {
    await open(page);

    await who(page)
      .getByRole('button', { name: t('admin.invitations.all') })
      .click();
    await expect(what(page).getByRole('button')).toHaveText(
      `Send to ${CONFIRMED.length} addresses`,
    );

    await who(page)
      .getByRole('button', { name: t('admin.invitations.none') })
      .click();
    await expect(what(page).getByRole('button')).toHaveText(
      t('admin.invitations.selectFirst'),
    );
  });

  test('narrows the list by a search', async ({ page }) => {
    await open(page);

    await who(page)
      .getByLabel(t('admin.invitations.search'))
      .fill('zimmermann');
    await who(page)
      .getByRole('button', { name: t('admin.invitations.search') })
      .click();

    await expect(who(page).getByText('Zimmermann, Dieter')).toBeVisible();
    await expect(who(page).getByText('Okonkwo, Amina')).toBeHidden();
  });

  test('sends to the selected addresses and reports the progress (F56)', async ({
    page,
  }) => {
    await open(page);

    await who(page)
      .getByRole('button', { name: t('admin.invitations.all') })
      .click();
    await what(page)
      .getByLabel(t('admin.invitations.subject'))
      .fill('Come to the next one');
    await what(page)
      .getByLabel(t('admin.invitations.message'))
      .fill('we would love to see you again.\n\nRegistration is open.');
    await what(page).getByRole('button').click();

    // The answer comes before the mails do, so the page says so.
    await expect(page.getByRole('status')).toContainText(
      t('admin.invitations.onTheWay.many', { count: CONFIRMED.length }),
    );

    const row = log(page).getByRole('row', { name: /Come to the next one/ });
    await expect(row).toBeVisible();
    // And it ends up saying they went out, without the organizer doing
    // anything: the page polls until nothing is pending.
    await expect(row).toContainText(
      t('admin.invitations.progressDone', { sent: CONFIRMED.length }),
      {
        timeout: 30_000,
      },
    );
  });

  test('keeps the form and the selection when the message is empty', async ({
    page,
  }) => {
    await open(page);

    await who(page)
      .getByRole('button', { name: t('admin.invitations.all') })
      .click();
    await what(page)
      .getByLabel(t('admin.invitations.subject'))
      .fill('Only a subject');
    await what(page).getByRole('button').click();

    // Nothing was sent, so the selection is still the organizer's to use.
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(what(page).getByRole('button')).toHaveText(
      `Send to ${CONFIRMED.length} addresses`,
    );
    await expect(log(page).getByText('Only a subject')).toHaveCount(0);
  });

  test('offers the events of the series to invite to', async ({ page }) => {
    await open(page);

    const invite = what(page).getByLabel(t('admin.invitations.inviteTo'));
    await expect(invite).toBeVisible();
    // The event of the fixture is offered by name; selected by its id, which is
    // what the invitation stores.
    await expect(
      invite.getByRole('option', { name: /Overview Event/ }),
    ).toHaveCount(1);
    await invite.selectOption(seeded.eventId);
    await expect(invite).toHaveValue(seeded.eventId);
  });

  test('says plainly that nothing has been sent for a new series', async ({
    page,
  }) => {
    await open(page);

    await expect(
      log(page).getByText(t('admin.invitations.nothingSent')),
    ).toBeVisible();
  });
});
