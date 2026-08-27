import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './support/admin-session';
import {
  FILLER_ROWS,
  PARTICIPANTS,
  closeFixtureDatabase,
  removeParticipants,
  seedParticipants,
  type SeededEvent,
} from './support/registration-fixtures';

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
    seeded = await seedParticipants(
      `${test.info().project.name}-${Date.now()}`,
    );
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
      page.getByRole('heading', { name: 'Participants' }),
    ).toBeVisible();
    // Visible without a click — the usability correction of the thesis.
    const amina = page.getByRole('row', { name: /Okonkwo, Amina/ });
    await expect(amina).toContainText('@participants.example.org');

    // The default page holds 25 of 28 rows, so there is a second one.
    await expect(page.getByText(`${TOTAL_ROWS} registrations`)).toBeVisible();
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('Page 2 of 2')).toBeVisible();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    // The graph is there, and says what it shows without being seen.
    await expect(
      page.getByRole('img', { name: /Registrations per week/ }),
    ).toBeVisible();
  });

  test('searches by name and keeps the search in the address', async ({
    page,
  }) => {
    await page.goto(overview());

    await page.getByLabel('Search').fill('okonkwo amina');

    // One of two Okonkwos: both words have to match.
    await expect(
      page.getByRole('row', { name: /Okonkwo, Amina/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('row', { name: /Okonkwo, Chiara/ }),
    ).toBeHidden();
    await expect(
      page.getByText(`1 of ${TOTAL_ROWS} registrations`),
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
      page.getByText(`1 of ${TOTAL_ROWS} registrations`),
    ).toBeVisible();

    await page.getByRole('button', { name: /^All \(/ }).click();
    await page.getByRole('button', { name: 'Name' }).click();

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
    await expect(detail).not.toContainText('not yet');
    // Linkable: the opened registration is part of the address.
    await expect(page).toHaveURL(/[?&]selected=/);

    page.once('dialog', (dialog) => void dialog.accept());
    await detail.getByRole('button', { name: 'Cancel registration' }).click();

    await expect(detail).toContainText('cancelled');
    await expect(
      page.getByRole('button', { name: /^Cancelled \(2\)/ }),
    ).toBeVisible();

    await detail.getByRole('button', { name: 'Reinstate' }).click();

    // Back to confirmed, because the participant had confirmed themselves.
    await expect(detail).toContainText('confirmed');
    await expect(
      page.getByRole('button', { name: /^Cancelled \(1\)/ }),
    ).toBeVisible();
  });

  test('is reachable from the event series', async ({ page }) => {
    await page.goto(`/series/${seeded.seriesId}`);

    await page
      .getByRole('row', { name: new RegExp(seeded.eventName) })
      .getByRole('link', { name: 'Participants', exact: true })
      .click();

    await expect(page).toHaveURL(/\/participants$/);
    await expect(
      page.getByRole('heading', { name: 'Participants' }),
    ).toBeVisible();
  });
});
