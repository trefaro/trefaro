import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
import {
  removeRoomPlan,
  seedRoomPlan,
  type SeededRoomPlan,
} from './support/room-plan-fixtures';
import { asAdmin } from './support/series-fixtures';

/**
 * A participant reads the room plan (FR 3.6, E58) — AP 6 of phase 4.
 *
 * The participant's half of the package's acceptance criterion: the plan is
 * on the event page **without a login**, for everybody — a room name is not a
 * person, so unlike the proposals and the forum this section asks nobody to
 * sign in. What only a browser can decide here:
 *
 * - that the bundle draws the real plan where phase 0's demonstration stood:
 *   every room with its seats, the sessions in it in clock order, and no
 *   number about people (no sign-up count, no warning — those are the
 *   organizer's, E50);
 * - that a **language switch reaches the titles**: they are translated on the
 *   server (E56), so the section asks again — without a reload and without the
 *   element being replaced;
 * - that switching the plug-in off takes the tile **and** the section away
 *   without losing a room (E14).
 *
 * **Chromium only, and it restores what it found.** This file switches
 * `room-planning`, and `module_config` is one table the whole instance reads
 * while Playwright runs three engines (`docs/rules/e2e-tests.md`).
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4200';

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

test.describe.configure({ mode: 'serial' });

test.describe('the room planning plug-in on an event page', () => {
  let admin: APIRequestContext;
  /** `null` until read: a crash before the read must not write a guess. */
  let wasEnabled: boolean | null = null;
  let seeded: SeededRoomPlan;

  /**
   * Chromium in the hooks as well, not only in the tests (AP 12's lesson).
   *
   * A `test.skip` inside a test body skips that body — the hooks around it run
   * anyway, once per engine, and three of them reading and restoring one flag
   * means the first to finish puts it back while the others are still working.
   */
  test.beforeAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    admin = await asAdmin(CLIENT_URL);
    wasEnabled = await moduleEnabled(admin);
    // On first: the rooms are made through the plug-in's own routes.
    await setModule(admin, true);
    seeded = await seedRoomPlan(admin, `${process.pid}`);
  });

  test.afterAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    try {
      if (seeded) await removeRoomPlan(admin, seeded);
    } finally {
      if (wasEnabled !== null) await setModule(admin, wasEnabled);
      await admin.dispose();
    }
  });

  const eventPath = (): string =>
    `/series/${seeded.seriesSlug}/events/${seeded.eventSlug}`;

  const section = (page: Page) => page.locator('trefaro-plugin-room-planning');

  /** The card of one room, found by the name it shows. */
  const roomNamed = (page: Page, name: string) =>
    section(page)
      .locator('.room')
      .filter({ has: page.locator('.room__name', { hasText: name }) });

  const word = (key: string, locale?: string): string =>
    locale
      ? t(`plugins.roomPlanning.${key}`, {}, locale)
      : t(`plugins.roomPlanning.${key}`);

  test('is mounted for everybody, with its tile, and asks nobody to log in (E58)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    // No session at all: a visitor who followed a link.
    await page.goto(eventPath());
    const element = section(page);
    await expect(element).toBeAttached();
    await expect(element).toHaveAttribute('id', `plugin-${PLUGIN_KEY}`);
    await expect(element).toContainText(word('title'));

    const tile = page.locator('a.tile').filter({ hasText: word('label') });
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute('href', /#plugin-room-planning$/);
    // The glyph the descriptor has named since phase 0 (E49).
    expect(
      await tile.locator('.tile__icon svg path').getAttribute('d'),
    ).toMatch(/^M/);

    // The plan itself, not an invitation: the rooms are there.
    await expect(element.locator('.room')).toHaveCount(2);
    await expectNoRawKeys(page);
  });

  test('draws the rooms with their seats and the sessions in them, and no number about people — on a phone', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(eventPath());
    const element = section(page);
    // By name, as the server orders them — a plan is read room by room.
    await expect(element.locator('.room__name')).toHaveText([
      'Raum B',
      'Saal A',
    ]);

    const saalA = roomNamed(page, 'Saal A');
    await expect(saalA.locator('.room__meta')).toContainText('Ground floor');
    await expect(saalA.locator('.room__meta')).toContainText('40');
    await expect(saalA.locator('.room__meta')).toContainText(word('seats'));
    // In clock order, named — a slot without a title would be a time and
    // nothing else.
    await expect(saalA.locator('.booking__title')).toHaveText([
      seeded.plenaryTitle,
      seeded.panelTitle,
    ]);
    await expect(saalA.locator('.booking__time').first()).toContainText(
      /\d{1,2}:\d{2}/,
    );
    // The empty room says so.
    await expect(roomNamed(page, 'Raum B')).toContainText(word('noBookings'));
    // Nothing about people: the words of the organizer's section are absent.
    await expect(element).not.toContainText(word('signedUp'));
    await expect(element).not.toContainText(word('overbooked'));

    // Mobile first: the section fits the phone rather than scrolling sideways.
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expectNoRawKeys(page);
  });

  test('follows a language switch without a reload, and the titles come back translated (E56)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto(eventPath());
    const element = section(page);
    await expect(element.locator('.booking__title').first()).toHaveText(
      seeded.plenaryTitle,
    );

    // Two sentinels: one on the window, so a reload would be noticed, and one
    // on the element itself, so a remount would be.
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>)['e2eStillHere'] = true;
      document
        .querySelector('trefaro-plugin-room-planning')
        ?.setAttribute('data-e2e-mounted-once', 'yes');
    });

    await page.getByRole('combobox').selectOption('de');

    // The words from the catalogue and the title from the translation table:
    // two different sources, one switch.
    await expect(element).toContainText(word('title', 'de'));
    await expect(element.locator('.booking__title')).toHaveText([
      seeded.plenaryTitleDe,
      // Nobody translated the panel: the original stays (F95).
      seeded.panelTitle,
    ]);
    await expect(element).toHaveAttribute('data-e2e-mounted-once', 'yes');
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>)['e2eStillHere'],
      ),
    ).toBe(true);
    await expectNoRawKeys(page);
  });

  test('takes tile and section away when it is switched off, and keeps the rooms (E14)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await setModule(admin, false);

    try {
      await page.goto(eventPath());
      await expect(
        page.getByRole('heading', { level: 1, name: /E2E Rooms Event/ }),
      ).toBeVisible();
      await expect(section(page)).toHaveCount(0);
      await expect(
        page.locator('a.tile').filter({ hasText: word('label') }),
      ).toHaveCount(0);
      // Absent for the API too: the public route is a 404 while the plug-in
      // is off, like every other route of it.
      const response = await page.request.get(
        `/api/user/plugins/${PLUGIN_KEY}/events/${seeded.eventId}/rooms`,
      );
      expect(response.status()).toBe(404);
    } finally {
      await setModule(admin, true);
    }

    // And no room was lost while the switch was off.
    const rooms: unknown[] = await (
      await admin.get(
        `/api/admin/plugins/${PLUGIN_KEY}/events/${seeded.eventId}/rooms`,
      )
    ).json();
    expect(rooms).toHaveLength(2);
  });
});
