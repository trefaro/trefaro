import { expect, test } from '@playwright/test';

/**
 * The whitelabel theme, in a real browser (FR 1.4) — phase 2, AP 1.
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
 *    plug-ins are allowed to ship no CSS of their own.
 */

/** Reads a custom property off the document root, the way a plug-in would. */
const themeVariable = (name: string) =>
  `getComputedStyle(document.documentElement).getPropertyValue('${name}').trim()`;

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
