import { expect, test } from '@playwright/test';

/**
 * The whitelabel theme, in a real browser (FR 1.4) — phase 2, AP 1 and AP 3.
 *
 * The acceptance criterion of AP 1 is a chain: an administrator writes a colour
 * and a font, and a reload of either client shows them — inside plug-in web
 * components too. Its two halves are proven in two places on purpose:
 *
 * - **the write** in `apps/server-e2e/src/api/app-config.spec.ts`, where the
 *   `PATCH` is refused or accepted and `/api/config` changes with it;
 * - **the render**, here.
 *
 * Here the configuration is intercepted rather than written, because `app_config`
 * is a single row the whole instance reads and Playwright runs its files in
 * parallel workers: a spec that repainted the instance would make an unrelated
 * spec fail on the colour it asserts. Interception also lets one test cover what
 * no seeded instance can be in at once — a dark primary and a light accent.
 *
 * What only a browser can answer, and what this file is therefore for:
 *
 * 1. a `@font-face` of the bundled catalogue really resolves to a file this
 *    origin serves — no CDN anywhere in the chain (NFR 9);
 * 2. `readableTextColor` picks black on a light accent *as rendered*, not only
 *    in a unit test;
 * 3. the custom properties cross a shadow root, which is the whole reason
 *    plug-ins are allowed to ship no CSS of their own;
 * 4. the header names the *organization* rather than the product, and paints its
 *    logo — the half of AP 3 that lives in this client (the design page itself is
 *    covered in the organizer client's `design.spec.ts`).
 */

/** Reads a custom property off the document root, the way a plug-in would. */
const themeVariable = (name: string) =>
  `getComputedStyle(document.documentElement).getPropertyValue('${name}').trim()`;

/** Serves the instance's own configuration with the branding swapped out. */
async function withBranding(
  page: import('@playwright/test').Page,
  branding: { organizationName?: string; logoUrl?: string },
): Promise<void> {
  await page.route('**/api/config', async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    await route.fulfill({
      response,
      json: {
        ...config,
        ...(branding.organizationName
          ? { organizationName: branding.organizationName }
          : {}),
        theme: {
          ...config.theme,
          ...(branding.logoUrl ? { logoUrl: branding.logoUrl } : {}),
        },
      },
    });
  });
}

/** Serves the instance's own configuration with the theme swapped out. */
async function withTheme(
  page: import('@playwright/test').Page,
  theme: { primaryColor: string; accentColor: string; fontFamily: string },
): Promise<void> {
  await page.route('**/api/config', async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    await route.fulfill({
      response,
      json: { ...config, theme: { ...config.theme, ...theme } },
    });
  });
}

test.describe('the whitelabel theme in the browser', () => {
  test('renders the configured colours and picks a readable text colour', async ({
    page,
  }) => {
    await withTheme(page, {
      primaryColor: '#123456',
      // Deliberately light: the contrast decision has to come out black here,
      // which is the case a whitelabel application cannot assume away.
      accentColor: '#ffe066',
      fontFamily: "'Lora', Georgia, serif",
    });
    await page.goto('/');

    await expect
      .poll(() => page.evaluate(themeVariable('--trefaro-color-primary')))
      .toBe('#123456');
    expect(
      await page.evaluate(themeVariable('--trefaro-color-on-primary')),
    ).toBe('#ffffff');
    expect(
      await page.evaluate(themeVariable('--trefaro-color-on-accent')),
    ).toBe('#000000');
  });

  test('serves every bundled font from this origin, and loads the configured one', async ({
    page,
  }) => {
    await withTheme(page, {
      primaryColor: '#1f6f5c',
      accentColor: '#e8a33d',
      fontFamily: "'Lora', Georgia, serif",
    });
    await page.goto('/');

    // Matched rather than compared: WebKit hands a custom property back with
    // its quoting normalised (`"Lora"` for `'Lora'`), Chromium and Firefox echo
    // it verbatim. The family and the generic fallback are the assertion; the
    // quote character is the browser's business.
    await expect
      .poll(() => page.evaluate(themeVariable('--trefaro-font-family')))
      .toMatch(/Lora.*Georgia.*serif/);

    // `load` before `check`: a face is fetched when text needs it, and nothing
    // on the start page is in Lora yet. That the promise resolves to a face at
    // all is the assertion — a missing `@font-face` or a 404 leaves it empty.
    const faces = await page.evaluate(async () => {
      const loaded = await document.fonts.load("1rem 'Lora'");
      return {
        count: loaded.length,
        available: document.fonts.check("1rem 'Lora'"),
      };
    });
    expect(faces.count).toBeGreaterThan(0);
    expect(faces.available).toBe(true);
  });

  test('carries the organization in the header, not the product name', async ({
    page,
  }) => {
    // What AP 3 finished: the header used to read "Trefaro" for every
    // organization that installed this. Intercepted rather than written, for the
    // reason this file gives — but the *value* comes from the configuration
    // either way, which is the whole claim.
    await withBranding(page, {
      organizationName: 'Mehr Demokratie e.V.',
      logoUrl: '/api/media/branding/logo?v=1',
    });
    await page.goto('/');

    await expect(
      page.getByRole('link', { name: 'Mehr Demokratie e.V.' }),
    ).toBeVisible();
    // The logo is painted through the custom property, and it is decorative —
    // the name beside it says the same thing, so a screen reader hears it once.
    await expect
      .poll(() => page.evaluate(themeVariable('--trefaro-logo-url')))
      .toContain('/api/media/branding/logo');
    const logo = page.locator('.app-header__logo');
    await expect(logo).toBeAttached();
    await expect(logo).toHaveAttribute('aria-hidden', 'true');

    // And the browser tab, which is the other place the product name used to
    // stand (AP 13). The start page carries no route title of its own, so the
    // organization's name is the whole title.
    await expect(page).toHaveTitle('Mehr Demokratie e.V.');
  });

  test('shows the name this instance is configured with after a reload', async ({
    page,
  }) => {
    // No interception: the seeded instance's own name, read from the same
    // endpoint the header renders from. This is the half of the acceptance
    // criterion that says a saved brand survives a reload.
    await page.goto('/');
    const configured = (await (
      await page.request.get('/api/config')
    ).json()) as { organizationName: string };

    await page.reload();

    await expect(page.locator('.app-header__title')).toHaveText(
      configured.organizationName,
    );
  });

  test('reaches into a shadow root, which is why plug-ins ship no CSS', async ({
    page,
  }) => {
    await withTheme(page, {
      primaryColor: '#123456',
      accentColor: '#e8a33d',
      fontFamily: "'Lora', Georgia, serif",
    });
    await page.goto('/');
    await expect
      .poll(() => page.evaluate(themeVariable('--trefaro-color-primary')))
      .toBe('#123456');

    // Stands in for a plug-in's web component: a shadow root that styles itself
    // only through the theme's custom properties. The curated plug-in gets the
    // same check against its own rendering once AP 4 can switch it on.
    const inside = await page.evaluate(() => {
      const host = document.createElement('div');
      document.body.append(host);
      const shadow = host.attachShadow({ mode: 'open' });
      const probe = document.createElement('p');
      probe.style.color = 'var(--trefaro-color-primary)';
      probe.style.fontFamily = 'var(--trefaro-font-family)';
      shadow.append(probe);

      const style = getComputedStyle(probe);
      const result = { color: style.color, fontFamily: style.fontFamily };
      host.remove();
      return result;
    });

    // Reported as rgb(): a computed colour is resolved, not echoed back.
    expect(inside.color).toBe('rgb(18, 52, 86)');
    expect(inside.fontFamily).toContain('Lora');
  });
});
