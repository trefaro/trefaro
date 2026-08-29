import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './support/admin-session';
import { expectNoRawKeys, t } from './support/catalogue';

/**
 * The language switch in the organizer client (chapter 4, NFR 4) — phase 2,
 * AP 6.
 *
 * The module administration is the one screen in this client whose text already
 * came from the catalogue after AP 6: every core module and every plug-in
 * carries a `titleKey`, and the whole point of E22 is that resolving it is a
 * runtime lookup. So this is where the switch was first shown to *do*
 * something, and it is the assertion the acceptance criterion of AP 6 asks for.
 *
 * Since AP 9 the rest of the client is in the catalogue too, so the second test
 * here is the acceptance criterion of *that* package: an organizer who picks
 * German gets German — on the pages that need no fixture, which is what a suite
 * running against a shared instance can walk through without seeding.
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
      page.getByRole('heading', {
        level: 1,
        name: t('admin.modules.title'),
        exact: true,
      }),
    ).toBeVisible();

    // Shipped English: a core module and a curated plug-in, so both families of
    // key are covered.
    await expect(
      page.getByText(t('modules.mediaLinks.title'), { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(t('plugins.roomPlanning.title'), { exact: true }),
    ).toBeVisible();

    await page
      .getByRole('combobox', { name: t('language.switcher.label') })
      .selectOption('de');

    await expect(
      page.getByText(t('modules.mediaLinks.title', {}, 'de'), { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(t('plugins.roomPlanning.title', {}, 'de'), {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    // The key stays beside the name in every language: it is what the API,
    // `module_config` and a log call the thing.
    await expect(page.getByText('media-links', { exact: true })).toBeVisible();

    // Its own label is German by now, which is the point of the switch.
    await page
      .getByRole('combobox', { name: t('language.switcher.label', {}, 'de') })
      .selectOption('en');

    await expect(
      page.getByText(t('modules.mediaLinks.title'), { exact: true }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('remembers the choice across a reload', async ({ page }) => {
    await page.goto('/modules');
    await page
      .getByRole('combobox', { name: t('language.switcher.label') })
      .selectOption('de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    await page.reload();

    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(
      page.getByText(t('modules.mediaLinks.title', {}, 'de'), { exact: true }),
    ).toBeVisible();
  });

  test('carries German through the pages an organizer starts from', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('combobox', { name: t('language.switcher.label') })
      .selectOption('de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    // The side menu, which is on every page after this one.
    const menu = page.getByRole('navigation', {
      name: t('admin.nav.label', {}, 'de'),
    });
    await expect(
      menu.getByRole('link', { name: t('admin.series.title', {}, 'de') }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: t('admin.nav.signOut', {}, 'de') }),
    ).toBeVisible();

    // Three pages that need no fixture, so this test can run beside every
    // other one: the start page, the accounts, and the design settings.
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: t('admin.series.title', {}, 'de'),
      }),
    ).toBeVisible();
    await expectNoRawKeys(page);

    await menu
      .getByRole('link', { name: t('admin.admins.title', {}, 'de') })
      .click();
    await expect(
      page.getByRole('columnheader', {
        name: t('admin.admins.lastLogin', {}, 'de'),
      }),
    ).toBeVisible();
    await expectNoRawKeys(page);

    await menu
      .getByRole('link', { name: t('admin.design.title', {}, 'de') })
      .click();
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: t('admin.design.legibility', {}, 'de'),
      }),
    ).toBeVisible();
    await expectNoRawKeys(page);
  });
});
