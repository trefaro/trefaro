import { expect, test } from '@playwright/test';

/**
 * What the shipped proxy says about every page it serves (AP 9 of phase 5).
 *
 * Here rather than in either client suite for the reason this project exists
 * at all: the headers are written in `infra/nginx/trefaro-locations.conf` and
 * a development server sends none of them, so a suite running against
 * `nx serve` would assert a policy nobody is served. The same goes for the
 * API console, which is switched off by `NODE_ENV=production` and is therefore
 * only ever *off* in a container.
 *
 * The second test is the one that matters most and reads the least like a
 * security test: a content security policy that is too strict breaks the page
 * silently in whatever corner nobody opened. So the page is opened and the
 * console is read.
 */

/** The three whose whole value is worth comparing outright. */
const EXPECTED = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN',
  'referrer-policy': 'strict-origin-when-cross-origin',
} as const;

test.describe('every page the proxy serves', () => {
  for (const [name, path] of [
    ['the participant client', '/'],
    ['the organizer client', '/admin/'],
  ] as const) {
    test(`${name} carries the security headers`, async ({ request }) => {
      const response = await request.get(path);
      const headers = response.headers();

      expect(response.status()).toBe(200);
      for (const [header, value] of Object.entries(EXPECTED)) {
        expect({ header, value: headers[header] }).toEqual({ header, value });
      }

      // Spelled out rather than compared whole: what this asserts is the four
      // decisions, not the order somebody wrote them in.
      const policy = String(headers['content-security-policy']);
      expect(policy).toContain("default-src 'self'");
      expect(policy).toContain("script-src 'self'");
      // External media are linked, never embedded — the product rule, as a
      // header.
      expect(policy).toContain("frame-src 'none'");
      expect(policy).toContain("object-src 'none'");

      // The scanner needs a camera; nothing else needs anything.
      expect(headers['permissions-policy']).toContain('camera=(self)');
    });
  }

  test('renders the participant client without violating its own policy', async ({
    page,
  }) => {
    const refusals: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (/Content Security Policy|Permissions policy/i.test(text)) {
        refusals.push(text);
      }
    });

    await page.goto('/');
    await expect(page.locator('main.app-main')).toBeVisible();

    expect(refusals).toEqual([]);
  });

  test('renders the organizer client without violating its own policy', async ({
    page,
  }) => {
    const refusals: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (/Content Security Policy|Permissions policy/i.test(text)) {
        refusals.push(text);
      }
    });

    await page.goto('/admin/');
    // The sign-in page is what an unauthenticated visitor gets, and it is
    // enough: the stylesheet, the fonts and the configuration request have all
    // happened by the time its heading is on screen.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    expect(refusals).toEqual([]);
  });
});

test.describe('the API description', () => {
  test('is served, because the source is public anyway', async ({
    request,
  }) => {
    const response = await request.get('/api/docs-json');

    expect(response.status()).toBe(200);
    expect(((await response.json()) as { openapi: string }).openapi).toMatch(
      /^3\./,
    );
  });

  test('comes without the browsable console on a production instance', async ({
    request,
  }) => {
    // The decision of AP 9: the description is derivable from AGPL source, the
    // console is a third-party bundle on the organizer client's own origin.
    // `apps/server/src/app/core/config/api-docs.ts` carries the argument.
    const response = await request.get('/api/docs');

    expect(response.status()).toBe(404);
  });
});
