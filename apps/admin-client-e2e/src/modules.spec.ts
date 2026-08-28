import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './support/admin-session';

/**
 * The module administration in the browser (FR 1.5, UC 1) — phase 2, AP 4.
 *
 * Split along the same line as the design suite, and for the same reason:
 * `module_config` is one table the whole instance reads while Playwright runs
 * three browsers at once.
 *
 * - Everything that only reads — that the disabled modules are offered at all,
 *   that a plug-in shows its bundle, that the two families are told apart — runs
 *   in **all three browsers** and writes nothing.
 * - The one test that writes runs in **chromium only** and switches `push`,
 *   which is the module nothing else in these suites depends on. Deliberately
 *   *not* `media-links`: two other browser suites exercise it, and switching it
 *   off underneath them would fail them in a way that reads like a broken page.
 *   That the media links module — its endpoints, the participant's section and
 *   the organizer's dashboard tile — really goes away the moment the flag is
 *   written is asserted in `apps/server-e2e/src/api/modules.spec.ts`, where the
 *   suite runs alone.
 *
 * What only a browser can show is what this suite is for: that the gesture
 * reaches the flag, and that the page says what happens next (E20 — a plug-in's
 * web component is fetched during the client start sequence, so it appears after
 * a reload).
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

interface Module {
  key: string;
  enabled: boolean;
}

async function openModules(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Modules' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Modules', exact: true }),
  ).toBeVisible();
  // The table is filled from `GET /api/admin/modules`; without waiting for a row
  // every assertion below would race it.
  await expect(row(page, 'media-links')).toBeVisible();
}

/** The row of one module, found by the key it shows in a `<code>`. */
function row(page: Page, key: string) {
  return page.locator('tbody tr').filter({
    has: page.locator('code', { hasText: new RegExp(`^${key}$`) }),
  });
}

async function storedModule(page: Page, key: string): Promise<Module> {
  const response = await page.request.get('/api/admin/modules');
  expect(response.ok()).toBe(true);
  const modules = (await response.json()) as Module[];
  const found = modules.find((module) => module.key === key);
  expect(found, `no module "${key}"`).toBeTruthy();
  return found as Module;
}

async function restore(page: Page, module: Module): Promise<void> {
  const response = await page.request.patch(
    `/api/admin/modules/${module.key}`,
    { data: { enabled: module.enabled } },
  );
  expect(`${response.status()} ${await response.text()}`).toMatch(/^200/);
}

test.describe('the module administration in the browser', () => {
  test('offers the disabled modules too, which is the whole point', async ({
    page,
  }) => {
    await openModules(page);

    // `room-planning` ships switched off, and it is exactly the row an organizer
    // came here for. A page built from `/api/config` could not show it at all.
    await expect(row(page, 'room-planning')).toBeVisible();
    await expect(
      row(page, 'room-planning').getByRole('button', { name: 'Enable' }),
    ).toBeVisible();
    await expect(
      row(page, 'media-links').getByRole('button', { name: 'Disable' }),
    ).toBeVisible();
  });

  test('tells the two families apart, because only a plug-in has a bundle', async ({
    page,
  }) => {
    await openModules(page);

    await expect(row(page, 'room-planning')).toContainText('Plug-in');
    await expect(row(page, 'room-planning')).toContainText(
      '/api/plugins/room-planning/main.js',
    );
    await expect(row(page, 'media-links')).toContainText('Core module');
  });

  test('shows no module this version does not ship (E21)', async ({ page }) => {
    await openModules(page);

    // Four keys were core modules until AP 4 and one of them read its flag. A
    // switch wired to nothing is a prop, and it becomes visible the moment an
    // organizer is shown the list.
    for (const withdrawn of [
      'newsletter',
      'chat',
      'profiles',
      'profile-search',
    ]) {
      await expect(row(page, withdrawn)).toHaveCount(0);
    }
  });

  test('switches a module on, and says what happens next', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'writes the shared module_config table — three browsers in parallel would ' +
        'each assert what another just replaced',
    );
    const before = await storedModule(page, 'push');

    try {
      await openModules(page);
      await row(page, 'push').getByRole('button', { name: 'Enable' }).click();

      // The state in the row is what the server answered, not what was clicked.
      await expect(
        row(page, 'push').getByRole('button', { name: 'Disable' }),
      ).toBeVisible();
      await expect(row(page, 'push')).toContainText('enabled');
      // And the page says what a client has to do for the change to show up in
      // it (E20) — rather than leaving an organizer waiting for a redraw.
      await expect(page.getByRole('status')).toContainText('Reload');

      // It really was written: a reload finds it on.
      await page.reload();
      await expect(row(page, 'push')).toContainText('enabled');
      expect((await storedModule(page, 'push')).enabled).toBe(true);

      await row(page, 'push').getByRole('button', { name: 'Disable' }).click();

      await expect(
        row(page, 'push').getByRole('button', { name: 'Enable' }),
      ).toBeVisible();
      // Switching off deletes nothing, and the page is the place that says so.
      await expect(page.getByRole('status')).toContainText('data is untouched');
    } finally {
      await restore(page, before);
    }
  });
});
