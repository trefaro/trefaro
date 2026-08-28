import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './support/admin-session';

/**
 * The language switch in the organizer client (chapter 4, NFR 4) — phase 2,
 * AP 6.
 *
 * The module administration is the one screen in this client whose text already
 * comes from the catalogue after AP 6: every core module and every plug-in
 * carries a `titleKey`, and the whole point of E22 is that resolving it is a
 * runtime lookup. So this is where the switch can be shown to *do* something,
 * and it is the assertion the acceptance criterion of AP 6 asks for.
 *
 * It is also where the switch was found to be broken. The names were resolved in
 * a method the template called; this client is zoneless and the page is
 * `OnPush`, so a language change repainted nothing while `<html lang>` said
 * otherwise. No unit test saw it — the fake in `modules-page.spec.ts` was more
 * reactive than Transloco is. This suite is the second net, and the fake was
 * corrected to be the first.
 *
 * Writes nothing on the server, so all three browsers run it: the preference
 * lives in the browser context, which Playwright gives each test its own of.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe('organizer client language', () => {
  test('translates the module and plug-in names, and back', async ({
    page,
  }) => {
    await page.goto('/modules');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Modules', exact: true }),
    ).toBeVisible();

    // Shipped English: a core module and a curated plug-in, so both families of
    // key are covered.
    await expect(page.getByText('Media links', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Room planning', { exact: true }),
    ).toBeVisible();

    await page.getByRole('combobox', { name: 'Language' }).selectOption('de');

    await expect(page.getByText('Medien-Links', { exact: true })).toBeVisible();
    await expect(page.getByText('Raumplanung', { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    // The key stays beside the name in every language: it is what the API,
    // `module_config` and a log call the thing.
    await expect(page.getByText('media-links', { exact: true })).toBeVisible();

    await page.getByRole('combobox', { name: 'Sprache' }).selectOption('en');

    await expect(page.getByText('Media links', { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('remembers the choice across a reload', async ({ page }) => {
    await page.goto('/modules');
    await page.getByRole('combobox', { name: 'Language' }).selectOption('de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    await page.reload();

    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByText('Medien-Links', { exact: true })).toBeVisible();
  });
});
