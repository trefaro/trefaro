import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './support/admin-session';
import { t } from './support/catalogue';

/**
 * The organizer client's start sequence.
 *
 * The point worth proving here is that both clients read the same configuration
 * endpoint, so one theme change reaches both (FR 1.4).
 *
 * Since phase 1 the workspace is behind the login, so these tests reuse the
 * session the global setup established once. The login itself is exercised in
 * `login.spec.ts`, from a fresh context.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });
test.describe('organizer client startup', () => {
  test('renders the shell with its side navigation', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: t('admin.series.title') }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: t('admin.nav.label') }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: t('admin.modules.title') }),
    ).toBeVisible();
  });

  test('applies the same theme as the participant client', async ({ page }) => {
    await page.goto('/');

    await expect
      .poll(() =>
        page.evaluate(
          "getComputedStyle(document.documentElement).getPropertyValue('--trefaro-color-primary').trim()",
        ),
      )
      .toBe('#1f6f5c');
  });

  test('reaches the module administration and finds this image’s modules in it', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: t('admin.modules.title') }).click();

    // `level: 1` and `exact` are both needed: accessible-name matching is a
    // substring match, and the sidebar entry carries the same word.
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: t('admin.modules.title'),
        exact: true,
      }),
    ).toBeVisible();
    // Since AP 4 of phase 2 a *disabled* module has a row too — that is what
    // makes the page a switch rather than a report. What each row says, and what
    // a click does, is `modules.spec.ts`.
    await expect(page.getByText('media-links')).toBeVisible();
    // `exact`, because the plug-in's key is also part of its bundle URL in the
    // same row — Playwright's text matching is a substring match otherwise.
    await expect(
      page.getByText('room-planning', { exact: true }),
    ).toBeVisible();
  });

  test('mounts nothing in the navigation while no plug-in is enabled', async ({
    page,
  }) => {
    await page.goto('/');

    const slot = page.locator(
      '.trefaro-plugin-slot[data-mount-point="navigation"]',
    );
    await expect(slot).toBeAttached();
    expect(await slot.locator('> *').count()).toBe(0);
  });

  test('names the signed-in organizer and offers a way out', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(
      page.getByRole('button', { name: t('admin.nav.signOut') }),
    ).toBeVisible();
  });

  test('starts without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: t('admin.series.title') }),
    ).toBeVisible();

    expect(errors).toEqual([]);
  });
});
