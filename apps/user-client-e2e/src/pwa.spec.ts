import { expect, test } from '@playwright/test';
import { WEB_MANIFEST_PATH } from '@trefaro/shared-models';
import { expectNoRawKeys, t } from './support/catalogue';

/**
 * The installable participant client (F20, E26, E27) — phase 2, AP 12.
 *
 * What only a browser can decide, beyond the manifest's own contract suite:
 *
 * - **The document points at the served manifest**, not at a file in this
 *   image. That link is what makes the whole of E26 reach a home screen.
 * - **`theme-color` follows the configuration.** It was a literal in
 *   `index.html` until this package, so a branded instance had the
 *   organization's colour on the page and Trefaro's around it — and nothing
 *   below the browser can see that tag change.
 * - **Offline is a state, not a blank page.** The service worker is registered
 *   only in a production build, so what is checked here is the half that works
 *   in every build: the client says what happened and comes back on its own.
 *
 * Installing the application itself needs a device and an app store's worth of
 * platform behaviour; that is the part of the acceptance criterion a person
 * checks, and `verify-proxy.mjs` covers what a running deployment can answer.
 */
test.describe('the installable client', () => {
  test('links the manifest the server builds, not one from this image', async ({
    page,
    request,
  }) => {
    await page.goto('/');

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      WEB_MANIFEST_PATH,
    );

    const manifest = await request.get(WEB_MANIFEST_PATH);
    expect(manifest.status()).toBe(200);
    expect(manifest.headers()['content-type']).toContain(
      'application/manifest+json',
    );

    const document = await manifest.json();
    // The name on a home screen is the organization's, which is the whole of
    // E26 — and it is the same name the header of this page shows.
    await expect(page.locator('.app-header__title')).toHaveText(document.name);
  });

  test('paints the browser chrome in the configured colour', async ({
    page,
  }) => {
    await page.goto('/');

    // The instance colour, written onto the tag by ThemeService after the
    // configuration arrived — the literal in `index.html` is only the value
    // before that, and both happen to be this instance's colour, so the poll
    // waits for the theme rather than reading the fallback.
    await expect
      .poll(() =>
        page
          .locator('meta[name="theme-color"]')
          .getAttribute('content')
          .then((value) => value?.toLowerCase()),
      )
      .toBe('#1f6f5c');
    // One tag, not one per theme application.
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
  });

  test('says so when the connection is gone, and stops saying it', async ({
    page,
    context,
    browserName,
  }) => {
    // Playwright emulates offline in Chromium and Firefox; WebKit ignores the
    // switch, so the events this banner listens for never arrive there.
    test.skip(
      browserName === 'webkit',
      'WebKit does not emulate an offline context',
    );

    await page.goto('/');
    await expect(
      page.getByText(t('app.offline.title'), { exact: true }),
    ).toBeHidden();

    await context.setOffline(true);
    await expect(
      page.getByText(t('app.offline.title'), { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(t('app.offline.body'))).toBeVisible();

    await context.setOffline(false);
    await expect(
      page.getByText(t('app.offline.title'), { exact: true }),
    ).toBeHidden();
    await expectNoRawKeys(page);
  });

  test('offers no installation where the browser has not offered one', async ({
    page,
  }) => {
    await page.goto('/');

    // A hint that cannot be followed is an advertisement: the offer exists only
    // behind `beforeinstallprompt`, which none of these three headless browsers
    // fires. What is pinned here is the absence.
    await expect(
      page.getByRole('button', { name: t('app.install.action') }),
    ).toBeHidden();
  });
});
