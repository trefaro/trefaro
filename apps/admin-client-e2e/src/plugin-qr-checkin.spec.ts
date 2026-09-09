import {
  expect,
  request,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { ADMIN_STORAGE_STATE, fixtureLabel } from './support/admin-session';
import { expectNoRawKeys, t } from './support/catalogue';
import {
  admittedAt,
  closeDoorDatabase,
  removeDoor,
  seedDoor,
  ticketsOf,
  type SeededDoor,
} from './support/checkin-fixtures';
import {
  lockModuleSwitches,
  unlockModuleSwitches,
} from './support/module-lock';

/**
 * Holding the door at an event (FR 3.16, F199) — AP 8 of phase 4, and the
 * other half of **milestone M11**.
 *
 * The organizer's side of the package's acceptance criterion, walked without a
 * camera — deliberately, because that is the half a door may not depend on and
 * the half a suite can prove. What only a browser can decide here:
 *
 * - that the fourth plug-in tile stands in the dashboard's grid and jumps to
 *   the section it renders (E59);
 * - that a **typed** code admits somebody: the person is named on the screen
 *   and their row turns, without the list being read again;
 * - that the **button beside a row** reaches the same door with the same code
 *   (F199) — one route, whichever way the code got there;
 * - that a second reading of the same code says "already here since …" rather
 *   than refusing (E53), and that a code no ticket carries says nothing about
 *   who is expected;
 * - that the list holds the event's **confirmed** registrations and neither the
 *   pending one nor the cancelled one — the rule lives in the host adapter, and
 *   this is where it becomes visible;
 * - that switching the plug-in off takes tile and section away without losing
 *   an admission (E14).
 *
 * **Chromium only, and it restores what it found.** This file switches
 * `qr-checkin`, and `module_config` belongs to the whole instance while
 * Playwright runs three engines on several workers — the forum's suite counts
 * the plug-in tiles on a dashboard, so a fourth appearing mid-assertion would
 * be its failure and not this file's. Both hold the module lock
 * (`support/module-lock.ts`, `docs/rules/e2e-tests.md`).
 *
 * The four registrations in their three states are seeded — see
 * `support/checkin-fixtures.ts` for what is written by SQL and why. The
 * **tickets** are not: issuing them on the first read is what the plug-in does.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

const CLIENT_URL = process.env['BASE_URL'] ?? 'http://localhost:4300';

const PLUGIN_KEY = 'qr-checkin';

/** Crockford's base32, twenty-six characters — no I, no L, no O, no U. */
const CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

async function moduleEnabled(context: APIRequestContext): Promise<boolean> {
  const modules: { key: string; enabled: boolean }[] = await (
    await context.get('/api/admin/modules')
  ).json();
  return modules.find((one) => one.key === PLUGIN_KEY)?.enabled ?? false;
}

async function setModule(
  context: APIRequestContext,
  enabled: boolean,
): Promise<void> {
  const response = await context.patch(`/api/admin/modules/${PLUGIN_KEY}`, {
    data: { enabled },
  });
  expect(response.ok()).toBe(true);
}

/**
 * One worker for the whole file, because it holds one flag and the tests build
 * on each other — and Chromium in the hooks as well, not only in the tests: a
 * `test.skip` in a body skips that body while the hooks around it keep
 * running, once per engine.
 */
test.describe.configure({ mode: 'serial' });

test.describe('the QR check-in plug-in on the event dashboard', () => {
  let admin: APIRequestContext;
  /** `null` until read: a crash before the read must not write a guess. */
  let wasEnabled: boolean | null = null;
  let seeded: SeededDoor;

  test.beforeAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    // Waiting for the lock counts against this hook's timeout, and a suite
    // holding it needs about a minute.
    test.setTimeout(180_000);
    await lockModuleSwitches();

    admin = await request.newContext({
      baseURL: CLIENT_URL,
      storageState: ADMIN_STORAGE_STATE,
    });
    wasEnabled = await moduleEnabled(admin);
    await setModule(admin, true);
    seeded = await seedDoor(fixtureLabel(test.info().project.name));
  });

  test.afterAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    try {
      if (seeded) await removeDoor(seeded);
      await closeDoorDatabase();
    } finally {
      try {
        // In a `finally`: a cleanup that throws before restoring the flag
        // leaves the plug-in on for a suite that counts the tiles beside it.
        if (wasEnabled !== null) await setModule(admin, wasEnabled);
        await admin.dispose();
      } finally {
        await unlockModuleSwitches();
      }
    }
  });

  const dashboard = (): string =>
    `/series/${seeded.seriesId}/events/${seeded.eventId}`;

  const section = (page: Page) => page.locator('trefaro-plugin-qr-checkin');

  const word = (key: string): string => t(`plugins.qrCheckin.${key}`);

  /** The row of one person, found by the name it shows. */
  const rowOf = (page: Page, lastName: string): Locator =>
    section(page)
      .locator('tbody tr')
      .filter({ has: page.locator('.list__name', { hasText: lastName }) });

  async function openDashboard(page: Page): Promise<void> {
    await page.goto(dashboard());
    await expect(
      page.getByRole('heading', { name: seeded.eventName, level: 1 }),
    ).toBeVisible();
    await expect(section(page)).toContainText(word('doorTitle'));
  }

  /** Types a code into the door's field and presses the button beside it. */
  async function typeIn(page: Page, code: string): Promise<void> {
    await section(page).locator('input#qr-checkin-code').fill(code);
    await section(page)
      .locator('form')
      .getByRole('button', { name: word('admit') })
      .click();
  }

  test('gets a tile in the grid that jumps to the section it renders (E59)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await openDashboard(page);

    const tile = page.getByRole('article').filter({ hasText: word('label') });
    const link = tile.getByRole('link');
    await expect(link).toHaveAttribute(
      'href',
      new RegExp(`#plugin-${PLUGIN_KEY}$`),
    );
    // `qr_code_2`, the glyph the descriptor names, out of this instance's own
    // files (E49) — and no number on the tile: the list is the section's.
    expect(await link.locator('svg path').getAttribute('d')).toMatch(/^M/);
    await expect(tile.locator('.tile__value')).toHaveCount(0);

    await expect(section(page)).toHaveAttribute('id', `plugin-${PLUGIN_KEY}`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#plugin-${PLUGIN_KEY}$`));
    await expect(section(page)).toBeInViewport();
    await expectNoRawKeys(page);
  });

  test('lists the confirmed registrations by name, and nobody else', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await openDashboard(page);

    await expect(section(page).locator('.list__name')).toHaveText([
      `${seeded.expected[0].lastName}, Amina`,
      `${seeded.expected[1].lastName}, Bo`,
    ]);
    // The one who never confirmed and the one who gave up: no row, no ticket.
    await expect(section(page)).not.toContainText('Chen');
    await expect(section(page)).not.toContainText('Dara');
    expect(await ticketsOf(seeded.eventId)).toBe(2);

    // Nobody is in yet, and every row offers the way in (F199).
    await expect(section(page).locator('.list__state').first()).toContainText(
      word('waiting'),
    );
    await expect(
      section(page)
        .locator('tbody')
        .getByRole('button', {
          name: word('admit'),
        }),
    ).toHaveCount(2);
    await expectNoRawKeys(page);
  });

  test('admits somebody by the button beside their row (F199)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await openDashboard(page);
    const row = rowOf(page, seeded.expected[1].lastName);
    await row.getByRole('button', { name: word('admit') }).click();

    // Named on the screen, so whoever is holding the door can look up from it.
    await expect(section(page).locator('.verdict')).toContainText('Bo');
    await expect(section(page).locator('.verdict')).toContainText(
      word('admitted'),
    );
    // The row turns where it stands: somebody is waiting in front of the
    // screen, and a list that jumped back to its first page lost their place.
    await expect(row.locator('.list__state')).toContainText(word('checkedIn'));
    await expect(row.getByRole('button')).toHaveCount(0);
    expect(await admittedAt(seeded.expected[1].id)).not.toBeNull();
    await expectNoRawKeys(page);
  });

  test('admits somebody by a typed code, and says so again on a second reading (E53)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    // The code as a camera would have read it: out of the list the organizer
    // is already looking at, which is the same code either way (F199).
    const list: { rows: { registrationId: string; code: string }[] } = await (
      await admin.get(
        `/api/admin/plugins/${PLUGIN_KEY}/events/${seeded.eventId}/checkins`,
      )
    ).json();
    const code = list.rows.find(
      (one) => one.registrationId === seeded.expected[0].id,
    )?.code;
    expect(code).toMatch(CODE_PATTERN);

    await openDashboard(page);
    await typeIn(page, (code ?? '').toLowerCase());

    const row = rowOf(page, seeded.expected[0].lastName);
    await expect(section(page).locator('.verdict')).toContainText('Amina');
    await expect(row.locator('.list__state')).toContainText(word('checkedIn'));
    const first = await admittedAt(seeded.expected[0].id);
    expect(first).not.toBeNull();

    // Again, and it is not an error: "already here, since 09:12" is the
    // sentence somebody at a door needs.
    await typeIn(page, code ?? '');
    await expect(section(page).locator('.verdict')).toContainText(
      word('alreadyHere'),
    );
    await expect(section(page).locator('.verdict--no')).toHaveCount(0);
    // And the instant is the first one, not the latest.
    expect(await admittedAt(seeded.expected[0].id)).toEqual(first);
    await expectNoRawKeys(page);
  });

  test('says a code opens nothing, and keeps what was typed', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await openDashboard(page);
    await typeIn(page, 'ZZZZZZZZZZZZZZZZZZZZZZZZZZ');

    const refusal = section(page).locator('.verdict--no');
    await expect(refusal).toContainText(word('unknownCode'));
    // Nothing about who is expected behind this door.
    await expect(refusal).not.toContainText('Amina');
    await expect(refusal).not.toContainText('Bo');
    // Nothing was written, so nothing looks written: the next attempt is a
    // correction rather than a retype.
    await expect(section(page).locator('input#qr-checkin-code')).toHaveValue(
      'ZZZZZZZZZZZZZZZZZZZZZZZZZZ',
    );
    await expectNoRawKeys(page);
  });

  test('takes tile and section away when it is switched off, and keeps every admission (E14)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await setModule(admin, false);

    try {
      await page.goto(dashboard());
      await expect(
        page.getByRole('heading', { name: seeded.eventName, level: 1 }),
      ).toBeVisible();
      await expect(section(page)).toHaveCount(0);
      await expect(
        page.getByRole('article').filter({ hasText: word('label') }),
      ).toHaveCount(0);
      // Absent for the API too, like every route of a plug-in that is off.
      const response = await page.request.get(
        `/api/admin/plugins/${PLUGIN_KEY}/events/${seeded.eventId}/checkins`,
      );
      expect(response.status()).toBe(404);
    } finally {
      await setModule(admin, true);
    }

    // Switching off never deletes: both admissions are still there.
    expect(await admittedAt(seeded.expected[0].id)).not.toBeNull();
    expect(await admittedAt(seeded.expected[1].id)).not.toBeNull();
    await openDashboard(page);
    await expect(section(page).locator('.list__state').first()).toContainText(
      word('checkedIn'),
    );
  });
});
