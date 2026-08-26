import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './support/admin-session';

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
      page.getByRole('heading', { name: 'Event series' }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Modules' })).toBeVisible();
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

  test('lists the enabled core modules and no plug-in while none is on', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Modules' }).click();

    // `level: 1` and `exact` are both needed: the page also has a "Core
    // modules" heading, and accessible-name matching is a substring match.
    await expect(
      page.getByRole('heading', { level: 1, name: 'Modules', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('media-links')).toBeVisible();
    await expect(page.getByText('No plug-in is enabled')).toBeVisible();
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

    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('starts without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Event series' }),
    ).toBeVisible();

    expect(errors).toEqual([]);
  });
});
