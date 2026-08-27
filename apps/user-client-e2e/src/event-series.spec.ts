import { expect, test } from '@playwright/test';
import { DRAFT_SERIES, PUBLISHED_SERIES } from './support/series-fixtures';

/**
 * The participant's view of event series (FR 2.3), without a login.
 *
 * This is the acceptance criterion of AP 1's successor work package: a series an
 * organizer published shows up here, and one still in preparation does not.
 * Both fixtures are seeded through the administrative API in the global setup.
 */
test.describe('event series on the public start page', () => {
  test('lists a published series', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('link', { name: new RegExp(PUBLISHED_SERIES.name) }),
    ).toBeVisible();
    await expect(page.getByText(PUBLISHED_SERIES.description)).toBeVisible();
  });

  test('does not leak a series that is still a draft', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(DRAFT_SERIES.name)).toBeHidden();
  });

  test('opens a published series by its readable address', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('link', { name: new RegExp(PUBLISHED_SERIES.name) })
      .click();

    await expect(page).toHaveURL(
      new RegExp(`/series/${PUBLISHED_SERIES.slug}$`),
    );
    await expect(
      page.getByRole('heading', { name: PUBLISHED_SERIES.name }),
    ).toBeVisible();
    // Where AP 3 hangs the list of the series' events.
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
  });

  test('says a draft address does not exist rather than showing it', async ({
    page,
  }) => {
    await page.goto(`/series/${DRAFT_SERIES.slug}`);

    await expect(page.getByRole('alert')).toContainText('does not exist');
  });
});
