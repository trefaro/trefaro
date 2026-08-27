import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './support/admin-session';

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
    const name = `E2E Series ${testInfo.project.name} ${Date.now()}`;
    const description = 'Created by the organizer client e2e suite.';

    await page.goto('/');
    await page.getByRole('link', { name: 'New event series' }).click();

    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Description').fill(description);
    await page.getByRole('button', { name: 'Save' }).click();

    // Back on the list, with the new series on it and not yet public.
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('draft');
    // The address was derived from the name, so nobody had to think about URLs.
    await expect(row).toContainText('/series/e2e-series-');

    await row.getByRole('button', { name: 'Publish' }).click();
    await expect(row).toContainText('published');

    // Editing keeps the address, which is what makes a shared link durable.
    const addressBefore = await row.locator('code').innerText();
    await row.getByRole('link', { name }).click();
    // Wait for the form to hold the series before typing into it: it loads
    // asynchronously, and filling first would be a race the browser sometimes
    // wins.
    await expect(page.getByLabel('Name')).toHaveValue(name);
    await page.getByLabel('Name').fill(`${name} renamed`);
    await page.getByRole('button', { name: 'Save' }).click();

    const renamed = page.getByRole('row', {
      name: new RegExp(`${name} renamed`),
    });
    await expect(renamed).toBeVisible();
    await expect(renamed.locator('code')).toHaveText(addressBefore);

    page.once('dialog', (dialog) => void dialog.accept());
    await renamed.getByRole('button', { name: 'Delete' }).click();

    await expect(renamed).toBeHidden();
  });

  test('refuses to save a series without a description', async ({ page }) => {
    await page.goto('/series/new');
    await page.getByLabel('Name').fill('Nameless');

    await page.getByRole('button', { name: 'Save' }).click();

    // FR 2.1 makes both mandatory; the form must not post a half-filled series.
    await expect(page).toHaveURL(/\/series\/new$/);
  });
});
