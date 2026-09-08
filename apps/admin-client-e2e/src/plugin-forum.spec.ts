import {
  expect,
  request,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { ADMIN_STORAGE_STATE, fixtureLabel } from './support/admin-session';
import { expectNoRawKeys, t } from './support/catalogue';
import {
  closeForumDatabase,
  forumStates,
  removeForum,
  seedForum,
  type SeededForum,
} from './support/forum-fixtures';
import {
  lockModuleSwitches,
  unlockModuleSwitches,
} from './support/module-lock';

/**
 * Moderating the forum on the event dashboard (FR 4.6, E59) — AP 5 of phase 4.
 *
 * The organizer's half of the package's acceptance criterion, and it needs a
 * browser for three things a contract test cannot see:
 *
 * - that the **second** plug-in tile stands beside the first in the dashboard's
 *   grid, that each jumps to its own section, and that the hook point does with
 *   two plug-ins what it did with one (E59, F202);
 * - that the section the plug-in draws carries the **counts** and shows each
 *   waiting post **in the context of its thread** — the number is the
 *   plug-in's, in its own section, never on the host's tile;
 * - that a **decision is one click on one post** (E51, F195), and that the
 *   queue and the counts say so afterwards without a reload.
 *
 * **Chromium only, and it restores what it found.** This file switches `forum`
 * **and** `program-proposals` — the second one because the two tiles side by
 * side are the criterion — and `module_config` belongs to the whole instance
 * while Playwright runs three engines on several workers. Because the
 * proposals suite switches the same flag, both files hold the module lock for
 * their whole run (`support/module-lock.ts`, `docs/rules/e2e-tests.md`).
 *
 * The thread and its two waiting posts are seeded into the plug-in's own
 * tables — see `support/forum-fixtures.ts` for why, and where opening a thread
 * itself is asserted instead.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

const CLIENT_URL = process.env['BASE_URL'] ?? 'http://localhost:4300';

const PLUGIN_KEY = 'forum';
const NEIGHBOUR_KEY = 'program-proposals';

async function moduleEnabled(
  context: APIRequestContext,
  key: string,
): Promise<boolean> {
  const modules: { key: string; enabled: boolean }[] = await (
    await context.get('/api/admin/modules')
  ).json();
  return modules.find((one) => one.key === key)?.enabled ?? false;
}

async function setModule(
  context: APIRequestContext,
  key: string,
  enabled: boolean,
): Promise<void> {
  const response = await context.patch(`/api/admin/modules/${key}`, {
    data: { enabled },
  });
  expect(response.ok()).toBe(true);
}

/**
 * One worker for the whole file, because it holds two flags — and Chromium in
 * the hooks as well, not only in the tests: a `test.skip` in a body skips that
 * body while the hooks around it keep running, once per engine.
 */
test.describe.configure({ mode: 'serial' });

test.describe('the discussion forum plug-in on the event dashboard', () => {
  let admin: APIRequestContext;
  /** `null` until read: a crash before the read must not write a guess. */
  let wasEnabled: boolean | null = null;
  let neighbourWasEnabled: boolean | null = null;
  let seeded: SeededForum;

  test.beforeAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    // Waiting for the lock counts against this hook's timeout, and the suite
    // holding it needs about half a minute.
    test.setTimeout(180_000);
    await lockModuleSwitches();

    admin = await request.newContext({
      baseURL: CLIENT_URL,
      storageState: ADMIN_STORAGE_STATE,
    });
    wasEnabled = await moduleEnabled(admin, PLUGIN_KEY);
    neighbourWasEnabled = await moduleEnabled(admin, NEIGHBOUR_KEY);
    await setModule(admin, PLUGIN_KEY, true);
    await setModule(admin, NEIGHBOUR_KEY, true);
    seeded = await seedForum(fixtureLabel(test.info().project.name));
  });

  test.afterAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    try {
      if (seeded) await removeForum(seeded);
      await closeForumDatabase();
    } finally {
      try {
        // In a `finally`: a cleanup that throws before restoring the flags
        // leaves two plug-ins on for every later suite. Only what was read is
        // put back.
        if (neighbourWasEnabled !== null) {
          await setModule(admin, NEIGHBOUR_KEY, neighbourWasEnabled);
        }
        if (wasEnabled !== null) {
          await setModule(admin, PLUGIN_KEY, wasEnabled);
        }
        await admin.dispose();
      } finally {
        await unlockModuleSwitches();
      }
    }
  });

  const dashboard = (): string =>
    `/series/${seeded.seriesId}/events/${seeded.eventId}`;

  const section = (page: Page) => page.locator('trefaro-plugin-forum');

  const pluginTiles = (page: Page) => page.locator('article.tile--plugin');

  test('gets a tile in the grid that jumps to the section it renders (E59)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto(dashboard());
    await expect(
      page.getByRole('heading', { name: seeded.eventName, level: 1 }),
    ).toBeVisible();

    const tile = page
      .getByRole('article')
      .filter({ hasText: t('plugins.forum.label') });
    const link = tile.getByRole('link');
    await expect(link).toHaveAttribute(
      'href',
      new RegExp(`#plugin-${PLUGIN_KEY}$`),
    );
    // The glyph the descriptor names, from this instance's own files (E49).
    expect(await link.locator('svg path').getAttribute('d')).toMatch(/^M/);
    // And no number on it: the count belongs to the section below.
    await expect(tile.locator('.tile__value')).toHaveCount(0);

    // The element the tile points at, mounted by the host at the hook point,
    // with the id the slot puts on it.
    await expect(section(page)).toBeAttached();
    await expect(section(page)).toHaveAttribute('id', `plugin-${PLUGIN_KEY}`);
    await expectNoRawKeys(page);
  });

  test('stands beside the proposals tile, and each jumps to its own section', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto(dashboard());
    await expect(
      page.getByRole('heading', { name: seeded.eventName, level: 1 }),
    ).toBeVisible();

    // Two tiles, in the order the plug-ins are registered (E59) — and the two
    // sections below in the same order, so the tiles are not shuffled against
    // what they point at.
    await expect(pluginTiles(page)).toHaveCount(2);
    await expect(pluginTiles(page).nth(0)).toContainText(
      t('plugins.programProposals.label'),
    );
    await expect(pluginTiles(page).nth(1)).toContainText(
      t('plugins.forum.label'),
    );
    await expect(pluginTiles(page).nth(0).getByRole('link')).toHaveAttribute(
      'href',
      new RegExp(`#plugin-${NEIGHBOUR_KEY}$`),
    );
    await expect(pluginTiles(page).nth(1).getByRole('link')).toHaveAttribute(
      'href',
      new RegExp(`#plugin-${PLUGIN_KEY}$`),
    );
    const mounted = page.locator(
      '.trefaro-plugin-slot[data-mount-point="event-dashboard"] > *',
    );
    await expect(mounted).toHaveCount(2);
    expect(
      await mounted.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-plugin')),
      ),
    ).toEqual([NEIGHBOUR_KEY, PLUGIN_KEY]);

    // The jump itself: a click on the forum's tile lands on the forum's
    // section, not on its neighbour's.
    await pluginTiles(page).nth(1).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`#plugin-${PLUGIN_KEY}$`));
    await expect(section(page)).toBeInViewport();
    await expectNoRawKeys(page);
  });

  test('draws the counts and the queue, each post in the context of its thread', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto(dashboard());
    const panel = section(page);
    await expect(panel).toContainText(t('plugins.forum.moderation'));

    // Two waiting, nothing decided — the numbers the plug-in fetched itself.
    const counts = panel.locator('.count');
    await expect(counts).toHaveCount(3);
    await expect(counts.nth(0)).toContainText('2');
    await expect(counts.nth(0)).toContainText(t('plugins.forum.statusPending'));
    await expect(counts.nth(1)).toContainText('0');

    // What approving does — to the post and to its thread (F195), said where
    // the button is.
    await expect(panel).toContainText(t('plugins.forum.approvalNote'));

    for (const body of seeded.bodies) {
      const row = panel.locator('.row').filter({ hasText: body });
      await expect(row).toBeVisible();
      // A post out of context is a sentence without its question.
      await expect(row.locator('.row__thread')).toContainText(
        seeded.threadTitle,
      );
    }
    // Attributed by name, never by address (F55).
    await expect(panel).toContainText(seeded.authorName);
    await expect(panel).not.toContainText(seeded.authorEmail);
    await expectNoRawKeys(page);
  });

  test('approves one with a click, and says so without a reload', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto(dashboard());
    const panel = section(page);
    const first = panel.locator('.row').filter({ hasText: seeded.bodies[0] });
    await expect(first).toBeVisible();

    await first
      .getByRole('button', { name: t('plugins.forum.approve') })
      .click();

    // The queue is one shorter and the counts have moved — the section read
    // itself again rather than editing its own numbers.
    await expect(
      panel.locator('.row').filter({ hasText: seeded.bodies[0] }),
    ).toHaveCount(0);
    await expect(panel.locator('.count').nth(0)).toContainText('1');
    await expect(panel.locator('.count').nth(1)).toContainText('1');
    // Still waiting: the second one, untouched by the first click — decided
    // post by post, never per thread (F195).
    await expect(
      panel.locator('.row').filter({ hasText: seeded.bodies[1] }),
    ).toBeVisible();

    // And in the database, which is the only place that settles it.
    expect(await forumStates(seeded.eventId)).toEqual({
      pending: 1,
      approved: 1,
    });
  });

  test('rejects the other one, and the row stays (E14)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto(dashboard());
    const panel = section(page);
    const second = panel.locator('.row').filter({ hasText: seeded.bodies[1] });
    await expect(second).toBeVisible();

    await second
      .getByRole('button', { name: t('plugins.forum.reject') })
      .click();

    await expect(panel).toContainText(t('plugins.forum.queueEmpty'));
    await expect(panel.locator('.count').nth(2)).toContainText('1');

    // Rejected, not deleted: the row keeps showing its status to whoever wrote
    // it, and a refusal that removed it would look like a post that never
    // arrived.
    expect(await forumStates(seeded.eventId)).toEqual({
      approved: 1,
      rejected: 1,
    });
  });

  test('takes tile and section away when it is switched off, and its neighbour stays', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await setModule(admin, PLUGIN_KEY, false);

    try {
      await page.goto(dashboard());
      // The page first: its own heading is what says this dashboard arrived.
      await expect(
        page.getByRole('heading', { name: seeded.eventName, level: 1 }),
      ).toBeVisible();

      await expect(section(page)).toHaveCount(0);
      await expect(
        page.getByRole('article').filter({ hasText: t('plugins.forum.label') }),
      ).toHaveCount(0);
      // The other plug-in and the event's own tiles are untouched: a plug-in
      // leaving takes nothing of the dashboard with it.
      await expect(pluginTiles(page)).toHaveCount(1);
      await expect(
        page.locator('trefaro-plugin-program-proposals'),
      ).toBeAttached();
      await expect(
        page.getByRole('article').filter({ hasText: t('admin.program.title') }),
      ).toBeVisible();
    } finally {
      await setModule(admin, PLUGIN_KEY, true);
    }

    // And no row was lost while the switch was off (E14).
    expect(await forumStates(seeded.eventId)).toEqual({
      approved: 1,
      rejected: 1,
    });
  });
});
