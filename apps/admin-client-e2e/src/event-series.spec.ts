import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE, fixtureLabel } from './support/admin-session';

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
    await page.getByRole('link', { name: 'New event series' }).click();

    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Description').fill(description);
    await page.getByRole('button', { name: 'Save' }).click();

    // Saving lands on the series itself, where the first event would be added.
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page).toHaveURL(/\/series\/[0-9a-f-]{36}$/);
    // The address was derived from the name, so nobody had to think about URLs.
    const address = page.locator('code');
    await expect(address).toContainText('/series/e2e-series-');
    const addressBefore = await address.innerText();

    await page.getByRole('link', { name: 'Back to all series' }).click();

    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('draft');
    await row.getByRole('button', { name: 'Publish' }).click();
    await expect(row).toContainText('published');

    // Editing keeps the address, which is what makes a shared link durable.
    await row.getByRole('link', { name }).click();
    await page.getByRole('link', { name: 'Edit series' }).click();
    // Wait for the form to hold the series before typing into it: it loads
    // asynchronously, and filling first would be a race the browser sometimes
    // wins.
    await expect(page.getByLabel('Name')).toHaveValue(name);
    await page.getByLabel('Name').fill(`${name} renamed`);
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(
      page.getByRole('heading', { name: `${name} renamed` }),
    ).toBeVisible();
    await expect(page.locator('code')).toHaveText(addressBefore);

    // Deleting happens here, where the events that would go with it are listed.
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Delete series' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('row', { name: new RegExp(`${name} renamed`) }),
    ).toBeHidden();
  });

  test('refuses to save a series without a description', async ({ page }) => {
    await page.goto('/series/new');
    await page.getByLabel('Name').fill('Nameless');

    await page.getByRole('button', { name: 'Save' }).click();

    // FR 2.1 makes both mandatory; the form must not post a half-filled series.
    await expect(page).toHaveURL(/\/series\/new$/);
  });
});
