import { expect, test, type Page } from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
import { PUBLISHED_SERIES, UPCOMING_EVENT } from './support/series-fixtures';

/**
 * A plug-in mounted in the participant client — phase 4, AP 1.
 *
 * What only a browser can answer about the client half of plug-in API 1.2.0:
 *
 * - that a bundle really is fetched at runtime, its custom element defined, and
 *   the element mounted at the event detail hook point;
 * - that the words it renders came from `GET /api/i18n/:locale` by way of the
 *   host (E48) — a unit test can hand the property over, but not prove that the
 *   catalogue travelled;
 * - that a **language switch reaches inside the custom element without a
 *   reload**, which is the one thing a zoneless application gets wrong quietly
 *   (F72), and that the element is not replaced in the process;
 * - that the tile for the plug-in draws the glyph its descriptor names, from
 *   this instance's own files (E49) — no request to a foreign origin (NFR 9).
 *
 * **The configuration is intercepted rather than written**, for the reason
 * `theming.spec.ts` gives: `module_config` is instance-wide state, the browser
 * suites run in parallel workers, and `start-up.spec.ts` asserts that the hook
 * point mounts nothing on a fresh instance. Switching `room-planning` on for
 * real would make that spec fail on a plug-in it never asked about — and the
 * rules of this repository send instance-wide state to `apps/server-e2e`. The
 * bundle itself is served whether the plug-in is enabled or not, so everything
 * below is the real chain apart from the flag.
 */

/** The descriptor `/api/config` carries when the plug-in is switched on. */
const ROOM_PLANNING = {
  key: 'room-planning',
  version: '0.1.0',
  labelKey: 'plugins.roomPlanning.label',
  elementName: 'trefaro-plugin-room-planning',
  bundleUrl: '/api/plugins/room-planning/main.js',
  mountPoints: ['event-detail', 'event-dashboard'],
  icon: 'meeting_room',
} as const;

/**
 * Serves the instance's own configuration with the plug-in switched on.
 *
 * Without a second copy of it: since AP 6 the plug-in's own suite switches
 * `room-planning` on for real for a minute, and eight workers mean this file
 * may run inside that minute. An entry that is already there is replaced, not
 * doubled — two descriptors with one key would mount two elements and make
 * every locator below ambiguous.
 */
async function withRoomPlanning(page: Page): Promise<void> {
  await page.route('**/api/config', async (route) => {
    const response = await route.fetch();
    const config: {
      enabledModules: string[];
      plugins: { key: string }[];
    } = await response.json();
    await route.fulfill({
      response,
      json: {
        ...config,
        enabledModules: [
          ...config.enabledModules.filter((key) => key !== ROOM_PLANNING.key),
          ROOM_PLANNING.key,
        ],
        plugins: [
          ...config.plugins.filter(
            (plugin) => plugin.key !== ROOM_PLANNING.key,
          ),
          ROOM_PLANNING,
        ],
      },
    });
  });
}

const eventPath = `/series/${PUBLISHED_SERIES.slug}/events/${UPCOMING_EVENT.slug}`;

test.describe('a plug-in at the event detail hook point', () => {
  test('is mounted with the words the instance serves for it', async ({
    page,
  }) => {
    await withRoomPlanning(page);
    await page.goto(eventPath);

    const element = page.locator('trefaro-plugin-room-planning');
    await expect(element).toBeAttached();
    // Assigned by the slot rather than by the bundle, because the tile below
    // links to it (FR 1.5).
    await expect(element).toHaveAttribute('id', 'plugin-room-planning');

    // The heading is `strings['title']` inside the element: the catalogue was
    // fetched by the host, selected by prefix and handed over as a property.
    await expect(element).toContainText(t('plugins.roomPlanning.title'));
    await expectNoRawKeys(page);
  });

  test('gets its tile, with the glyph its descriptor names', async ({
    page,
  }) => {
    await withRoomPlanning(page);
    await page.goto(eventPath);

    const tile = page
      .locator('a.tile')
      .filter({ hasText: t('plugins.roomPlanning.label') });
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute('href', /#plugin-room-planning$/);

    // Path data from this instance's own bundle — the field the contract
    // carried since phase 0 and nobody drew until now. Named by its class
    // since AP 7 of phase 5: a tile is a row with two glyphs now, the
    // plug-in's in front and the chevron behind it.
    const glyph = tile.locator('.tile__icon svg path');
    await expect(glyph).toHaveCount(1);
    expect(await glyph.getAttribute('d')).toMatch(/^M/);
  });

  test('follows a language switch without a reload and without remounting', async ({
    page,
  }) => {
    await withRoomPlanning(page);
    await page.goto(eventPath);

    const element = page.locator('trefaro-plugin-room-planning');
    await expect(element).toContainText(t('plugins.roomPlanning.title'));

    // Two sentinels: one on the window, so a reload would be noticed, and one
    // on the element itself, so a remount would be.
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>)['e2eStillHere'] = true;
      document
        .querySelector('trefaro-plugin-room-planning')
        ?.setAttribute('data-e2e-mounted-once', 'yes');
    });

    await page.getByRole('combobox').selectOption('de');

    await expect(element).toContainText(
      t('plugins.roomPlanning.title', {}, 'de'),
    );
    await expect(element).toHaveAttribute('data-e2e-mounted-once', 'yes');
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>)['e2eStillHere'],
      ),
    ).toBe(true);
    await expectNoRawKeys(page);
  });
});
