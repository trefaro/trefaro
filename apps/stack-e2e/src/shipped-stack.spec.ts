import { expect, test } from '@playwright/test';

/**
 * What only the shipped stack can show: production builds behind the real
 * NGINX, talking to a real server in another container.
 *
 * Deliberately a handful. This project is not a second copy of the browser
 * suites — those run against `nx serve` and cover the behaviour. What is
 * asserted here is the assembly: that the three images, the proxy and the
 * database are wired to each other the way `infra/docker-compose.yml` claims.
 */
test.describe('the shipped stack', () => {
  test('serves the participant client from its own image', async ({ page }) => {
    await page.goto('/');

    // The production build, so the element is the compiled root rather than a
    // development shell, and the participant client's own shell is what came
    // back (both clients bootstrap `trefaro-root`, so that alone proves little).
    await expect(page.locator('trefaro-root')).toBeAttached();
    await expect(page.locator('main.app-main')).toBeVisible();
  });

  test('answers a deep link into a client route with the application', async ({
    page,
  }) => {
    // NGINX serves `index.html` for anything the client routes itself (F111),
    // and the application then resolves the route. A 404 here means `try_files`
    // is wrong in the shipped proxy configuration, which no development server
    // would ever show: `nx serve` has its own fallback.
    const response = await page.goto(
      '/events/11111111-1111-4111-8111-111111111111',
    );

    expect(response?.status()).toBe(200);
    await expect(page.locator('trefaro-root')).toBeAttached();
  });

  test('serves the organizer client under /admin/ with its own base href', async ({
    page,
  }) => {
    await page.goto('/admin/');

    // Built with `BASE_HREF=/admin/` (a build-time argument in the compose
    // file), so a wrong argument shows up as an application that cannot load
    // its own assets.
    const baseHref = await page.evaluate(
      () => document.querySelector('base')?.getAttribute('href') ?? null,
    );
    expect(baseHref).toBe('/admin/');
    await expect(page.locator('trefaro-root')).toBeAttached();
  });

  test('reaches the server through the proxy from the browser', async ({
    page,
  }) => {
    await page.goto('/');

    // The client reads its configuration at start-up (E27), so if this is not
    // answered the page renders unthemed and nothing else in the stack works
    // either. Asserted from inside the page, which is the path a user takes.
    const health = await page.evaluate(async () => {
      const response = await fetch('/api/health');
      return response.status;
    });

    expect(health).toBe(200);
  });
});
