import { expect, test } from '@playwright/test';
import { PUBLISHED_SERIES, UPCOMING_EVENT } from './support/series-fixtures';

/**
 * The participant client's start sequence, end to end.
 *
 * What only a browser can confirm: that the configuration is fetched before the
 * first paint, that the theme really lands on the document as CSS custom
 * properties, and that the public pages need no login.
 */

/** Reads a custom property off the document root, the way a plug-in would. */
const themeVariable = (name: string) =>
  `getComputedStyle(document.documentElement).getPropertyValue('${name}').trim()`;

test.describe('participant client startup', () => {
  test('renders the public start page without a login', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Event series' }),
    ).toBeVisible();
    // Nothing on this page may require credentials, and nothing may report a
    // failure — the series it lists are seeded through the API in the setup.
    await expect(page.getByRole('alert')).toBeHidden();
  });

  test('applies the theme it fetched from the server', async ({ page }) => {
    await page.goto('/');

    // The seeded instance theme, applied before the first render.
    await expect
      .poll(() => page.evaluate(themeVariable('--trefaro-color-primary')))
      .toBe('#1f6f5c');
    expect(await page.evaluate(themeVariable('--trefaro-color-accent'))).toBe(
      '#e8a33d',
    );
    // Shades stay derived rather than snapshotted.
    expect(
      await page.evaluate(themeVariable('--trefaro-color-primary-soft')),
    ).toContain('color-mix');
    // Contrast-picked text colour, not a fixed one.
    expect(
      await page.evaluate(themeVariable('--trefaro-color-on-primary')),
    ).toBe('#ffffff');
  });

  test('reports the loaded configuration on the spike console', async ({
    page,
  }) => {
    await page.goto('/spikes');

    await expect(
      page.getByRole('heading', { name: 'Architecture spikes' }),
    ).toBeVisible();
    // A loaded configuration means the fallback warning is absent.
    await expect(page.getByText('running on its fallback theme')).toBeHidden();
    // media-links is the one core module that ships enabled.
    await expect(page.getByText('media-links')).toBeVisible();
  });

  test('mounts nothing at the event detail hook point while no plug-in is enabled', async ({
    page,
  }) => {
    // The real landing page carries the hook point since AP 3; the phase-0
    // placeholder page it used to live on is gone.
    await page.goto(
      `/series/${PUBLISHED_SERIES.slug}/events/${UPCOMING_EVENT.slug}`,
    );

    await expect(
      page.getByRole('heading', { name: UPCOMING_EVENT.name }),
    ).toBeVisible();
    const slot = page.locator(
      '.trefaro-plugin-slot[data-mount-point="event-detail"]',
    );
    await expect(slot).toBeAttached();
    expect(await slot.locator('> *').count()).toBe(0);
  });

  test('serves the plug-in bundle the configuration points at', async ({
    request,
  }) => {
    const response = await request.get('/api/plugins/room-planning/main.js');

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('trefaro-plugin-room-planning');
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

  test('resolves an unknown route to the start page', async ({ page }) => {
    await page.goto('/no-such-page');

    await expect(
      page.getByRole('heading', { name: 'Event series' }),
    ).toBeVisible();
  });
});
