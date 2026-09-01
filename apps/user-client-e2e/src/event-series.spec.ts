import { expect, test } from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
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

  test('shows the logo of a series it was uploaded for (FR 2.1)', async ({
    page,
  }) => {
    await page.goto('/');

    const logo = page
      .getByRole('link', { name: new RegExp(PUBLISHED_SERIES.name) })
      .locator('img');
    await expect(logo).toBeVisible();

    // The address names the row, never a stored path (E19). Asserting the shape
    // here and not only in the API suite, because this is the one place where
    // the URL the server wrote and the URL a browser fetches are the same thing.
    const source = await logo.getAttribute('src');
    expect(source).toMatch(
      /^\/api\/media\/series\/[0-9a-f-]{36}\/logo\?v=\d+$/,
    );

    // And it actually arrives: an `<img>` with a broken source is visible too.
    const image = await page.request.get(source ?? '');
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/png');
  });

  test('draws the logo on the series page as well', async ({ page }) => {
    await page.goto(`/series/${PUBLISHED_SERIES.slug}`);

    await expect(page.locator('header img')).toBeVisible();
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
    await expect(
      page.getByRole('heading', { name: t('series.upcoming') }),
    ).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('says a draft address does not exist rather than showing it', async ({
    page,
  }) => {
    await page.goto(`/series/${DRAFT_SERIES.slug}`);

    await expect(page.getByRole('alert')).toHaveText(t('series.errorMissing'));
  });
});
