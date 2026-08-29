import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE, fixtureLabel } from './support/admin-session';
import { t } from './support/catalogue';

/**
 * Managing event series in the browser (UC 02, UC 03, FR 2.1, FR 2.2).
 *
 * Uses the session the global setup established once. Each browser works on its
 * own series — three engines run the same spec against one instance — and
 * removes it again, so the suite is repeatable and leaves nothing behind.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe('event series administration', () => {
  test('creates a series, publishes it and deletes it again', async ({
    page,
  }, testInfo) => {
    // Unique per run: three browsers share one instance, and a row left over
    // from a failed run must not turn into an ambiguous match here.
    const name = `E2E Series ${fixtureLabel(testInfo.project.name)}`;
    const description = 'Created by the organizer client e2e suite.';

    await page.goto('/');
    await page.getByRole('link', { name: t('admin.series.new') }).click();

    await page.getByLabel(t('admin.series.name')).fill(name);
    await page.getByLabel(t('admin.series.description')).fill(description);
    await page.getByRole('button', { name: t('admin.common.save') }).click();

    // Saving lands on the series itself, where the first event would be added.
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page).toHaveURL(/\/series\/[0-9a-f-]{36}$/);
    // The address was derived from the name, so nobody had to think about URLs.
    const address = page.locator('code');
    await expect(address).toContainText('/series/e2e-series-');
    const addressBefore = await address.innerText();

    await page
      .getByRole('link', { name: t('admin.series.backToList') })
      .click();

    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await expect(row).toContainText(t('eventSeriesStatus.draft'));
    await row.getByRole('button', { name: t('admin.series.publish') }).click();
    await expect(row).toContainText(t('eventSeriesStatus.published'));

    // Editing keeps the address, which is what makes a shared link durable.
    await row.getByRole('link', { name }).click();
    await page
      .getByRole('link', { name: t('admin.series.editSeries') })
      .click();
    // Wait for the form to hold the series before typing into it: it loads
    // asynchronously, and filling first would be a race the browser sometimes
    // wins.
    await expect(page.getByLabel(t('admin.series.name'))).toHaveValue(name);
    await page.getByLabel(t('admin.series.name')).fill(`${name} renamed`);
    await page.getByRole('button', { name: t('admin.common.save') }).click();

    await expect(
      page.getByRole('heading', { name: `${name} renamed` }),
    ).toBeVisible();
    await expect(page.locator('code')).toHaveText(addressBefore);

    // Deleting happens here, where the events that would go with it are listed.
    page.once('dialog', (dialog) => void dialog.accept());
    await page
      .getByRole('button', { name: t('admin.series.deleteSeries') })
      .click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('row', { name: new RegExp(`${name} renamed`) }),
    ).toBeHidden();
  });

  test('refuses to save a series without a description', async ({ page }) => {
    await page.goto('/series/new');
    await page.getByLabel(t('admin.series.name')).fill('Nameless');

    await page.getByRole('button', { name: t('admin.common.save') }).click();

    // FR 2.1 makes both mandatory; the form must not post a half-filled series.
    await expect(page).toHaveURL(/\/series\/new$/);
  });
});
