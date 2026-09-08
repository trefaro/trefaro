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
  lockModuleSwitches,
  unlockModuleSwitches,
} from './support/module-lock';
import {
  assignmentsOf,
  closeRoomDatabase,
  removeRoomPlan,
  roomsOf,
  seedRoomPlan,
  type SeededRoomPlan,
} from './support/room-fixtures';

/**
 * Planning rooms on the event dashboard (FR 3.11, E50) — AP 6 of phase 4.
 *
 * The organizer's half of the package's acceptance criterion, walked for
 * real: a room is added with its seats, renamed, and deleted; sessions are put
 * in and taken out; and the plan shows an overbooking **and** a double booking
 * without refusing either assignment. What only a browser can decide here:
 *
 * - that the room plan's bundle now draws at the dashboard's hook point too —
 *   the third plug-in there, with the tile the host draws for it (E59, F193);
 * - that a **warning stands at the session and at the room**, in words the
 *   catalogue supplies, and that widening the room takes it away again — the
 *   warning is computed when read, stored nowhere;
 * - that **nothing is disabled or refused** because of a warning (E50): the
 *   button that overbooks a room is the same button as any other.
 *
 * **Chromium only, and it restores what it found.** This file switches
 * `room-planning`, and `module_config` belongs to the whole instance while
 * Playwright runs three engines on several workers. The module suite asserts
 * this very flag is *off*, so both hold the module lock for their run
 * (`support/module-lock.ts`, `docs/rules/e2e-tests.md`).
 *
 * The three sessions and the three seats are seeded — see
 * `support/room-fixtures.ts` for what is seeded by SQL and why. The rooms are
 * not: making them is what this suite does.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

const CLIENT_URL = process.env['BASE_URL'] ?? 'http://localhost:4300';

const PLUGIN_KEY = 'room-planning';

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
 * One worker for the whole file, because it holds one flag and the tests
 * build on each other — and Chromium in the hooks as well, not only in the
 * tests: a `test.skip` in a body skips that body while the hooks around it
 * keep running, once per engine.
 */
test.describe.configure({ mode: 'serial' });

test.describe('the room planning plug-in on the event dashboard', () => {
  let admin: APIRequestContext;
  /** `null` until read: a crash before the read must not write a guess. */
  let wasEnabled: boolean | null = null;
  let seeded: SeededRoomPlan;

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
    seeded = await seedRoomPlan(fixtureLabel(test.info().project.name));
  });

  test.afterAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    try {
      if (seeded) await removeRoomPlan(seeded);
      await closeRoomDatabase();
    } finally {
      try {
        // In a `finally`: a cleanup that throws before restoring the flag
        // leaves the plug-in on for the module suite, which asserts it is off.
        if (wasEnabled !== null) await setModule(admin, wasEnabled);
        await admin.dispose();
      } finally {
        await unlockModuleSwitches();
      }
    }
  });

  const dashboard = (): string =>
    `/series/${seeded.seriesId}/events/${seeded.eventId}`;

  const section = (page: Page) => page.locator('trefaro-plugin-room-planning');

  /** The card of one room, found by the name it shows. */
  const roomNamed = (page: Page, name: string): Locator =>
    section(page)
      .locator('.room')
      .filter({ has: page.locator('.room__name', { hasText: name }) });

  const word = (key: string): string => t(`plugins.roomPlanning.${key}`);

  async function openDashboard(page: Page): Promise<void> {
    await page.goto(dashboard());
    await expect(
      page.getByRole('heading', { name: seeded.eventName, level: 1 }),
    ).toBeVisible();
    await expect(section(page)).toContainText(word('title'));
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
    // The glyph the descriptor has named since phase 0, from this instance's
    // own files (E49) — and no number on the tile: the plan is the section's.
    expect(await link.locator('svg path').getAttribute('d')).toMatch(/^M/);
    await expect(tile.locator('.tile__value')).toHaveCount(0);

    await expect(section(page)).toHaveAttribute('id', `plugin-${PLUGIN_KEY}`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#plugin-${PLUGIN_KEY}$`));
    await expect(section(page)).toBeInViewport();
    await expectNoRawKeys(page);
  });

  test('adds a room, and the plan shows it with its seats', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await openDashboard(page);
    const panel = section(page);
    await expect(panel).toContainText(word('emptyPlan'));

    await panel.getByRole('button', { name: word('newRoom') }).click();
    const form = panel.locator('form.room-form');
    await form.locator('input[name="name"]').fill('Saal A');
    await form.locator('input[name="capacity"]').fill('2');
    await form.locator('input[name="floor"]').fill('Erdgeschoss');
    await form.getByRole('button', { name: word('save') }).click();

    // Drawn from the plan the server answered, not from the form.
    const room = roomNamed(page, 'Saal A');
    await expect(room).toBeVisible();
    await expect(room.locator('.room__meta')).toContainText('Erdgeschoss');
    await expect(room.locator('.room__meta')).toContainText('2');
    await expect(room.locator('.room__meta')).toContainText(word('seats'));
    await expect(panel.locator('form.room-form')).toHaveCount(0);
    await expect(panel).not.toContainText(word('emptyPlan'));

    expect(await roomsOf(seeded.eventId)).toEqual([
      { name: 'Saal A', capacity: 2 },
    ]);
    await expectNoRawKeys(page);
  });

  test('puts sessions in rooms and shows an overbooking and a double booking, refusing neither (E50)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    // The second room through the plug-in's own route: adding one is the
    // previous test's subject, and this one is about what happens in two.
    const created = await admin.post(
      `/api/admin/plugins/${PLUGIN_KEY}/events/${seeded.eventId}/rooms`,
      { data: { name: 'Raum B', capacity: 20 } },
    );
    expect(created.status()).toBe(201);

    await openDashboard(page);

    // Three people into two chairs. The button is the same button as any
    // other, and the plan says what that means — at the session and at the
    // room.
    const saalA = roomNamed(page, 'Saal A');
    await saalA
      .locator('select[name="session"]')
      .selectOption({ value: seeded.plenary.id });
    await saalA.getByRole('button', { name: word('place') }).click();
    const plenary = saalA
      .locator('.booking')
      .filter({ hasText: seeded.plenary.title });
    await expect(plenary).toBeVisible();
    await expect(plenary.locator('.booking__signups')).toContainText('3');
    await expect(plenary.locator('.warning')).toHaveText([word('overbooked')]);
    await expect(saalA.locator('.room__warnings .warning')).toHaveText([
      word('overbooked'),
    ]);

    // Two sessions at half past eleven in one room: a double booking, on
    // both of them and on the room.
    const raumB = roomNamed(page, 'Raum B');
    await raumB
      .locator('select[name="session"]')
      .selectOption({ value: seeded.workshop.id });
    await raumB.getByRole('button', { name: word('place') }).click();
    await expect(raumB.locator('.booking')).toHaveCount(1);
    await expect(raumB.locator('.warning')).toHaveCount(0);

    await raumB
      .locator('select[name="session"]')
      .selectOption({ value: seeded.panel.id });
    await raumB.getByRole('button', { name: word('place') }).click();
    await expect(raumB.locator('.booking')).toHaveCount(2);
    await expect(raumB.locator('.booking .warning')).toHaveText([
      word('doubleBooked'),
      word('doubleBooked'),
    ]);
    await expect(raumB.locator('.room__warnings .warning')).toHaveText([
      word('doubleBooked'),
    ]);

    // Nothing was refused: all three assignments are rows.
    expect(await assignmentsOf(seeded.eventId)).toBe(3);
    await expectNoRawKeys(page);
  });

  test('renames a room and widens it, and the warning goes — it was never stored', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await openDashboard(page);
    const saalA = roomNamed(page, 'Saal A');
    await expect(saalA.locator('.room__warnings .warning')).toHaveCount(1);

    await saalA.getByRole('button', { name: word('edit') }).click();
    const form = saalA.locator('form.room-form');
    // The form starts from the room as it is.
    await expect(form.locator('input[name="name"]')).toHaveValue('Saal A');
    await expect(form.locator('input[name="capacity"]')).toHaveValue('2');
    await form.locator('input[name="name"]').fill('Großer Saal');
    await form.locator('input[name="capacity"]').fill('10');
    await form.getByRole('button', { name: word('save') }).click();

    const renamed = roomNamed(page, 'Großer Saal');
    await expect(renamed).toBeVisible();
    await expect(renamed.locator('.room__meta')).toContainText('10');
    // Ten chairs for three people: the plan, read again, has nothing to say.
    await expect(renamed.locator('.warning')).toHaveCount(0);
    await expect(renamed.locator('.booking')).toHaveCount(1);

    expect(await roomsOf(seeded.eventId)).toEqual([
      { name: 'Großer Saal', capacity: 10 },
      { name: 'Raum B', capacity: 20 },
    ]);
  });

  test('takes a session out, and deletes a room with its assignments while the sessions stay', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await openDashboard(page);
    const raumB = roomNamed(page, 'Raum B');
    await expect(raumB.locator('.booking')).toHaveCount(2);

    await raumB
      .locator('.booking')
      .filter({ hasText: seeded.workshop.title })
      .getByRole('button', { name: word('remove') })
      .click();
    // One session left in the room, and nothing left to overlap with.
    await expect(raumB.locator('.booking')).toHaveCount(1);
    await expect(raumB.locator('.warning')).toHaveCount(0);

    // What deleting takes along is said where the button is.
    await expect(section(page)).toContainText(word('deleteNote'));
    await raumB.getByRole('button', { name: word('delete') }).click();
    await expect(roomNamed(page, 'Raum B')).toHaveCount(0);
    await expect(roomNamed(page, 'Großer Saal')).toBeVisible();

    expect(await roomsOf(seeded.eventId)).toEqual([
      { name: 'Großer Saal', capacity: 10 },
    ]);
    // The room's assignment went with it; the plenary's stayed in its room.
    expect(await assignmentsOf(seeded.eventId)).toBe(1);
    // And every session is still in the programme — a room is not a session.
    const sessions: unknown[] = await (
      await admin.get(`/api/admin/events/${seeded.eventId}/program-items`)
    ).json();
    expect(sessions).toHaveLength(3);
    await expectNoRawKeys(page);
  });

  test('takes tile and section away when it is switched off, and loses no row (E14)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await setModule(admin, false);

    try {
      await page.goto(dashboard());
      // The page first: its own heading is what says this dashboard arrived.
      await expect(
        page.getByRole('heading', { name: seeded.eventName, level: 1 }),
      ).toBeVisible();

      await expect(section(page)).toHaveCount(0);
      await expect(
        page.getByRole('article').filter({ hasText: word('label') }),
      ).toHaveCount(0);
      // The event's own tiles are untouched: a plug-in leaving takes nothing
      // of the dashboard with it.
      await expect(
        page.getByRole('article').filter({ hasText: t('admin.program.title') }),
      ).toBeVisible();
    } finally {
      await setModule(admin, true);
    }

    expect(await roomsOf(seeded.eventId)).toEqual([
      { name: 'Großer Saal', capacity: 10 },
    ]);
    expect(await assignmentsOf(seeded.eventId)).toBe(1);
  });
});
