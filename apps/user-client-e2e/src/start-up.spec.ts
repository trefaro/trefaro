import { expect, test } from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
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
      page.getByRole('heading', { name: t('start.title') }),
    ).toBeVisible();
    // Nothing on this page may require credentials, and nothing may report a
    // failure — the series it lists are seeded through the API in the setup.
    await expect(page.getByRole('alert')).toBeHidden();
    await expectNoRawKeys(page);
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
      page.getByRole('heading', { name: t('diagnostics.title') }),
    ).toBeVisible();
    // A loaded configuration means the fallback warning is absent.
    await expect(
      page.getByText(t('diagnostics.config.notLoaded')),
    ).toBeHidden();
    // media-links is the one core module that ships enabled. A module key is an
    // identifier, so it is one of the few strings on this page that stays as it
    // is in every language.
    await expect(page.getByText('media-links')).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('mounts exactly the plug-ins the configuration names at the event detail hook point', async ({
    page,
    request,
  }) => {
    // The configuration **this page** loads, caught on its way in: what the
    // slot must mount is what the instance said at that moment — not what it
    // says a few seconds later, when another suite has switched a plug-in.
    const configLoaded = page.waitForResponse('**/api/config');
    // The real landing page carries the hook point since AP 3; the phase-0
    // placeholder page it used to live on is gone.
    await page.goto(
      `/series/${PUBLISHED_SERIES.slug}/events/${UPCOMING_EVENT.slug}`,
    );
    const config: { plugins: { key: string; mountPoints: string[] }[] } =
      await (await configLoaded).json();

    await expect(
      page.getByRole('heading', { name: UPCOMING_EVENT.name }),
    ).toBeVisible();
    const slot = page.locator(
      '.trefaro-plugin-slot[data-mount-point="event-detail"]',
    );
    await expect(slot).toBeAttached();

    /*
     * Against the configuration rather than against zero — and that is a
     * stronger assertion, not a weaker one: what this test is for is that the
     * slot mounts what the instance says and nothing else. Zero was the same
     * sentence while every curated plug-in was off, and it stopped being one in
     * AP 3 of phase 4, when `plugin-program-proposals.spec.ts` began switching
     * one on for its own tests. Several files against one `module_config` is
     * the flake `docs/rules/e2e-tests.md` is mostly about.
     *
     * Against the configuration the page itself received, not a fresh read:
     * with three plug-in suites switching flags on eight workers (AP 6), a
     * configuration read a few seconds after the page loaded named a different
     * set than the one the page had mounted — correctly so, on both sides. The
     * DOM is still polled, because the bundles arrive after the configuration
     * does; and the message says which two lists did not agree, rather than
     * "expected true".
     */
    const configured = config.plugins
      .filter((plugin) => plugin.mountPoints.includes('event-detail'))
      .map((plugin) => plugin.key)
      .sort()
      .join(', ');

    const mounted = async (): Promise<string> =>
      (
        await slot
          .locator('> *')
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute('data-plugin') ?? '?'),
          )
      )
        .sort()
        .join(', ');

    await expect
      .poll(async () => {
        const inDom = await mounted();
        return inDom === configured
          ? 'the hook point mounts what the configuration names'
          : `mounted [${inDom}] while the configuration named [${configured}]`;
      })
      .toBe('the hook point mounts what the configuration names');
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
      page.getByRole('heading', { name: t('start.title') }),
    ).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('resolves an unknown route to the start page', async ({ page }) => {
    await page.goto('/no-such-page');

    await expect(
      page.getByRole('heading', { name: t('start.title') }),
    ).toBeVisible();
  });
});
