import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './support/admin-session';
import { t } from './support/catalogue';

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
  await page.getByRole('link', { name: t('admin.modules.title') }).click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: t('admin.modules.title'),
      exact: true,
    }),
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
      row(page, 'room-planning').getByRole('button', {
        name: t('admin.modules.enable'),
      }),
    ).toBeVisible();
    await expect(
      row(page, 'media-links').getByRole('button', {
        name: t('admin.modules.disable'),
      }),
    ).toBeVisible();
  });

  test('tells the two families apart, because only a plug-in has a bundle', async ({
    page,
  }) => {
    await openModules(page);

    await expect(row(page, 'room-planning')).toContainText(
      t('admin.modules.plugin'),
    );
    await expect(row(page, 'room-planning')).toContainText(
      '/api/plugins/room-planning/main.js',
    );
    await expect(row(page, 'media-links')).toContainText(
      t('admin.modules.core'),
    );
  });

  test('shows no module this version does not ship (E21)', async ({ page }) => {
    await openModules(page);

    // Six keys were core modules until AP 4 of phase 2 and one of them read its
    // flag. A switch wired to nothing is a prop, and it becomes visible the
    // moment an organizer is shown the list — so a key is listed here together
    // with the code behind it, never before. `profiles` earned its row back in
    // AP 1 of phase 3, `profile-search` in AP 5; `chat` has not yet.
    for (const withdrawn of ['newsletter', 'chat']) {
      await expect(row(page, withdrawn)).toHaveCount(0);
    }

    await expect(row(page, 'profiles')).toContainText(
      t('modules.profiles.title'),
    );
  });

  test('names in the row what a module needs before it can be on (E42)', async ({
    page,
  }) => {
    await openModules(page);

    // By name, not by key. An organizer who cannot switch the search on has to
    // be able to read why in the row rather than discover it from a 409 —
    // which is the whole reason the prerequisite travels in the payload.
    await expect(row(page, 'profile-search')).toContainText(
      t('admin.modules.requires', { modules: t('modules.profiles.title') }),
    );
    // And nothing of the sort where there is nothing to need.
    await expect(row(page, 'media-links')).not.toContainText(
      t('admin.modules.requires', { modules: t('modules.profiles.title') }),
    );
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
      await row(page, 'push')
        .getByRole('button', { name: t('admin.modules.enable') })
        .click();

      // The state in the row is what the server answered, not what was clicked.
      await expect(
        row(page, 'push').getByRole('button', {
          name: t('admin.modules.disable'),
        }),
      ).toBeVisible();
      await expect(row(page, 'push')).toContainText(t('admin.modules.enabled'));
      // And the page says what a client has to do for the change to show up in
      // it (E20) — rather than leaving an organizer waiting for a redraw.
      await expect(page.getByRole('status')).toContainText(
        t('admin.modules.switchedOn', { name: t('modules.push.title') }),
      );

      // It really was written: a reload finds it on.
      await page.reload();
      await expect(row(page, 'push')).toContainText(t('admin.modules.enabled'));
      expect((await storedModule(page, 'push')).enabled).toBe(true);

      await row(page, 'push')
        .getByRole('button', { name: t('admin.modules.disable') })
        .click();

      await expect(
        row(page, 'push').getByRole('button', {
          name: t('admin.modules.enable'),
        }),
      ).toBeVisible();
      // Switching off deletes nothing, and the page is the place that says so.
      await expect(page.getByRole('status')).toContainText(
        t('admin.modules.switchedOff', { name: t('modules.push.title') }),
      );
    } finally {
      await restore(page, before);
    }
  });
});
