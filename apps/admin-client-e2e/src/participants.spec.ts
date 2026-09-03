import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE, fixtureLabel } from './support/admin-session';
import {
  FILLER_ROWS,
  PARTICIPANTS,
  closeFixtureDatabase,
  removeParticipants,
  seedParticipants,
  type SeededEvent,
} from './support/registration-fixtures';
import { expectNoRawKeys, t, tPattern } from './support/catalogue';

/**
 * The participant overview in the browser (UC 08, FR 3.3) — AP 5.
 *
 * The highest rated function of the survey (3,86/4). What is asserted here is
 * what an organizer actually does with it: find someone, narrow the list, sort
 * it, open one registration and act on it — and that the e-mail address is
 * readable without a click, which is the one correction the usability test of the
 * thesis produced (E13).
 *
 * Each browser engine seeds its own event, because three of them run this spec
 * against one instance.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

const TOTAL_ROWS = PARTICIPANTS.length + FILLER_ROWS;

test.describe('participant overview', () => {
  let seeded: SeededEvent;

  test.beforeAll(async () => {
    // Per engine: three of them run this spec against one instance, and the
    // fixtures must not see each other's rows.
    seeded = await seedParticipants(fixtureLabel(test.info().project.name));
  });

  test.afterAll(async () => {
    if (seeded) await removeParticipants(seeded);
    await closeFixtureDatabase();
  });

  const overview = (): string =>
    `/series/${seeded.seriesId}/events/${seeded.eventId}/participants`;

  test('shows addresses in the table and pages through the registrations', async ({
    page,
  }) => {
    await page.goto(overview());

    await expect(
      page.getByRole('heading', { name: t('admin.participants.title') }),
    ).toBeVisible();
    // Visible without a click — the usability correction of the thesis.
    const amina = page.getByRole('row', { name: /Okonkwo, Amina/ });
    await expect(amina).toContainText('@participants.example.org');

    // The default page holds 25 of 28 rows, so there is a second one.
    await expect(
      page.getByText(
        t('admin.participants.matchAll.many', { shown: TOTAL_ROWS }),
      ),
    ).toBeVisible();
    await expect(
      page.getByText(t('admin.participants.pageOf', { page: 1, pages: 2 })),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: t('admin.common.previous') }),
    ).toBeDisabled();

    await page.getByRole('button', { name: t('admin.common.next') }).click();

    await expect(
      page.getByText(t('admin.participants.pageOf', { page: 2, pages: 2 })),
    ).toBeVisible();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(
      page.getByRole('button', { name: t('admin.common.next') }),
    ).toBeDisabled();

    // The graph is there, and says what it shows without being seen.
    await expect(
      page.getByRole('img', {
        name: tPattern('admin.participants.chartLabel.many'),
      }),
    ).toBeVisible();
  });

  test('keeps the e-mail column where it is in German too', async ({
    page,
  }) => {
    await page.goto(overview());
    await page
      .getByRole('combobox', { name: t('language.switcher.label') })
      .selectOption('de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    // The one correction the usability test produced (E13) is about *where* the
    // address is, so the check is the order of the headers rather than their
    // presence — in the language the organizer picked.
    const headers = await page.getByRole('columnheader').allInnerTexts();
    expect(headers.map((text) => text.replace(/[↑↓]/g, '').trim())).toEqual([
      t('admin.participants.colName', {}, 'de'),
      t('admin.participants.colEmail', {}, 'de'),
      t('admin.participants.colStatus', {}, 'de'),
      t('admin.participants.colRegistered', {}, 'de'),
      t('admin.participants.colNewsletter', {}, 'de'),
      t('admin.participants.colProfile', {}, 'de'),
      '',
    ]);
    await expect(
      page.getByRole('row', { name: /Okonkwo, Amina/ }),
    ).toContainText('@participants.example.org');
    await expectNoRawKeys(page);
  });

  test('marks the addresses that have a participant account (FR 3.3)', async ({
    page,
  }) => {
    await page.goto(overview());
    // Waited for, not assumed: `allInnerTexts()` does not wait, and an empty
    // row reads as a missing column.
    await expect(
      page.getByRole('row', { name: /Okonkwo, Amina/ }),
    ).toBeVisible();

    // The column phase 1 left out rather than shipping one that always says
    // "no profile" (E13). By cell rather than by row text: the newsletter
    // column next to it says "Yes" as well, so a row-wide assertion would pass
    // without this column existing. The order is pinned by the header test
    // above — name, address, status, registered, newsletter, profile.
    const profileCell = async (name: RegExp): Promise<string> => {
      const cells = await page
        .getByRole('row', { name })
        .getByRole('cell')
        .allInnerTexts();
      return cells[5].trim();
    };

    expect(await profileCell(/Okonkwo, Amina/)).toBe(
      t('admin.participants.yes'),
    );
    expect(await profileCell(/Adeyemi, Bruno/)).toBe('—');

    // The detail panel names it too, so an organizer who opened one row does
    // not have to go back to the table for it. **Named**, like the panel test
    // further down: there are two complementary landmarks on this page, and an
    // unnamed locator either hits both — a strict-mode violation the moment
    // the panel is open — or hits the workspace sidebar alone and passes on
    // its "Profilformular" navigation entry, which contains the word this line
    // is looking for and says nothing about the panel.
    await page
      .getByRole('row', { name: /Okonkwo, Amina/ })
      .getByRole('link')
      .first()
      .click();
    await expect(
      page.getByRole('complementary', { name: 'Amina Okonkwo' }),
    ).toContainText(t('admin.participants.colProfile'));
    await expectNoRawKeys(page);
  });

  test('searches by name and keeps the search in the address', async ({
    page,
  }) => {
    await page.goto(overview());

    await page.getByLabel(t('admin.participants.search')).fill('okonkwo amina');

    // One of two Okonkwos: both words have to match.
    await expect(
      page.getByRole('row', { name: /Okonkwo, Amina/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('row', { name: /Okonkwo, Chiara/ }),
    ).toBeHidden();
    await expect(
      page.getByText(
        // The noun agrees with the number it follows, which in a filtered
        // count is the total — "1 of 28 registrations".
        t('admin.participants.matchFiltered.many', {
          shown: 1,
          total: TOTAL_ROWS,
        }),
      ),
    ).toBeVisible();
    // In the URL, so the view can be sent to a colleague.
    await expect(page).toHaveURL(/[?&]search=okonkwo%20amina/);
  });

  test('filters by status and sorts by name', async ({ page }) => {
    await page.goto(overview());

    await page.getByRole('button', { name: /^Cancelled \(1\)/ }).click();

    await expect(
      page.getByRole('row', { name: /Okonkwo, Chiara/ }),
    ).toBeVisible();
    await expect(page.getByRole('row', { name: /Adeyemi/ })).toBeHidden();
    await expect(
      page.getByText(
        // The noun agrees with the number it follows, which in a filtered
        // count is the total — "1 of 28 registrations".
        t('admin.participants.matchFiltered.many', {
          shown: 1,
          total: TOTAL_ROWS,
        }),
      ),
    ).toBeVisible();

    await page.getByRole('button', { name: /^All \(/ }).click();
    await page
      .getByRole('button', { name: t('admin.participants.colName') })
      .click();

    // Ascending by surname: Adeyemi comes before every filler person.
    const firstRow = page.getByRole('row').nth(1);
    await expect(firstRow).toContainText('Adeyemi, Bruno');
    await expect(
      page.getByRole('columnheader', { name: /^Name/ }),
    ).toHaveAttribute('aria-sort', 'ascending');
  });

  test('opens one registration, cancels it, and puts it back', async ({
    page,
  }) => {
    await page.goto(overview());

    await page.getByRole('link', { name: 'Zimmermann, Dieter' }).click();

    // Named after the participant, so it is not the workspace's own sidebar.
    const detail = page.getByRole('complementary', {
      name: 'Dieter Zimmermann',
    });
    await expect(
      detail.getByRole('heading', { name: 'Dieter Zimmermann' }),
    ).toBeVisible();
    await expect(detail).toContainText('Leipzig');
    // Confirmed, so a date rather than "not yet" — and that is what makes
    // reinstating able to restore the confirmation later.
    await expect(detail).not.toContainText(t('admin.participants.notYet'));
    // Linkable: the opened registration is part of the address.
    await expect(page).toHaveURL(/[?&]selected=/);

    page.once('dialog', (dialog) => void dialog.accept());
    await detail
      .getByRole('button', { name: t('admin.participants.cancelRegistration') })
      .click();

    await expect(detail).toContainText(t('registration.status.cancelled'));
    await expect(
      page.getByRole('button', { name: /^Cancelled \(2\)/ }),
    ).toBeVisible();

    await detail
      .getByRole('button', { name: t('admin.participants.reinstate') })
      .click();

    // Back to confirmed, because the participant had confirmed themselves.
    await expect(detail).toContainText(t('registration.status.confirmed'));
    await expect(
      page.getByRole('button', { name: /^Cancelled \(1\)/ }),
    ).toBeVisible();
  });

  test('is reachable from the event series', async ({ page }) => {
    await page.goto(`/series/${seeded.seriesId}`);

    await page
      .getByRole('row', { name: new RegExp(seeded.eventName) })
      .getByRole('link', { name: t('admin.participants.title'), exact: true })
      .click();

    await expect(page).toHaveURL(/\/participants$/);
    await expect(
      page.getByRole('heading', { name: t('admin.participants.title') }),
    ).toBeVisible();
  });
});
