import { expect, test } from '@playwright/test';

/**
 * The one bug class this project can produce that every other suite is blind to.
 *
 * The participant client's service worker is served from the root, so its scope
 * is the whole origin — the organizer client under `/admin/` included. Angular
 * answers every navigation inside that scope out of its own cache unless
 * `navigationUrls` excludes it, and the participant client has no route for
 * `/admin/`: its wildcard route redirects to `/`. Between 28.08.2026 and the fix
 * that followed, an organizer could not reach the organizer client at all — and
 * only in the shipped stack.
 *
 * Nothing else sees it. The unit tests do not run a worker, the API contract
 * suite uses `fetch` (which runs no worker either), and both browser suites run
 * against `nx serve`, where Angular registers no worker at all. The `images` job
 * builds the three images without ever starting them together.
 *
 * `verify-proxy.mjs` reasons about `ngsw.json` with ngsw's own selection rule,
 * which is a strong static check and still a static one. These tests are the
 * behavioural half: a real worker, registered and in control of a real page,
 * behind the real proxy.
 */
test.describe('the shipped service worker', () => {
  test('registers and takes control of the participant client', async ({
    page,
  }) => {
    await page.goto('/');

    // `registerWhenStable:30000` — registration waits for the application to
    // become stable, so this is not instantaneous on a cold container.
    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.scope;
    });
    expect(scope).toMatch(/\/$/);

    // A worker controls the pages that were loaded after it activated, so the
    // first navigation is never controlled. The reload is the point: from here
    // on the worker answers, and everything below is asserted against a page it
    // is actually serving.
    await page.reload();
    const controlled = await page.evaluate(
      () => navigator.serviceWorker.controller !== null,
    );
    expect(controlled).toBe(true);
  });

  test('leaves the organizer client to the network', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    expect(
      await page.evaluate(() => navigator.serviceWorker.controller !== null),
    ).toBe(true);

    // The navigation that was broken. With `/admin` missing from
    // `navigationUrls`, the worker answers this out of the participant client's
    // cache and Angular's wildcard route sends the organizer back to `/`.
    await page.goto('/admin/');

    // Both clients bootstrap the same `trefaro-root` element, so the element is
    // no discriminator at all. These three are: the document the browser ended
    // up with was built for `/admin/`, the address did not get rewritten, and —
    // the symptom itself — the participant client's own navigation is not what
    // answered.
    const baseHref = await page.evaluate(
      () => document.querySelector('base')?.getAttribute('href') ?? null,
    );
    expect(baseHref).toBe('/admin/');
    await expect(page).toHaveURL(/\/admin\//);
    await expect(page.locator('nav.app-nav')).toHaveCount(0);
  });

  test('leaves the API to the network while it is in control', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();

    // Read through the page, so the request goes past the worker rather than
    // past Playwright's own request context.
    const config = await page.evaluate(async () => {
      const response = await fetch('/api/config');
      return { status: response.status, body: await response.json() };
    });

    // What this adds over `verify-proxy.mjs`, which asserts the same endpoint
    // far more thoroughly, is only the path the request took: past a registered
    // worker rather than past `fetch` in Node. So the assertion is structural —
    // the answer came from the server and not from a cache that happened to
    // hold something shaped like it.
    expect(config.status).toBe(200);
    expect(config.body).toHaveProperty('theme');
  });
});
