import {
  expect,
  request,
  test,
  type APIRequestContext,
} from '@playwright/test';
import { ADMIN_STORAGE_STATE, fixtureLabel } from './support/admin-session';
import { expectNoRawKeys, t } from './support/catalogue';
import {
  closeProposalDatabase,
  proposalStates,
  removeProposals,
  seedProposals,
  type SeededProposals,
} from './support/proposal-fixtures';

/**
 * Moderating proposals on the event dashboard (FR 3.14, E59) — AP 3 of phase 4.
 *
 * The organizer's half of the package's acceptance criterion, and it needs a
 * browser for three things a contract test cannot see:
 *
 * - that the **new hook point exists on a real page**: the plug-in's bundle is
 *   fetched by this client too, its element mounted below the dashboard's
 *   table, and the tile in the dashboard's own grid jumps to it (E59);
 * - that the section the plug-in draws carries the **counts** — the number is
 *   the plug-in's, in its own section, never on the host's tile;
 * - that a **decision is one click**, and that the queue and the counts say so
 *   afterwards without a reload.
 *
 * **Chromium only, and it restores what it found.** This file switches
 * `program-proposals`, and `module_config` belongs to the whole instance while
 * Playwright runs three engines (`docs/rules/e2e-tests.md`).
 *
 * The two waiting proposals are seeded into the plug-in's own table — see
 * `support/proposal-fixtures.ts` for why, and where the submission itself is
 * asserted instead.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

const CLIENT_URL = process.env['BASE_URL'] ?? 'http://localhost:4300';

const PLUGIN_KEY = 'program-proposals';

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
 * One worker for the whole file, because it holds one flag — and Chromium in
 * the hooks as well, not only in the tests: a `test.skip` in a body skips that
 * body while the hooks around it keep running, once per engine.
 */
test.describe.configure({ mode: 'serial' });

test.describe('the programme proposals plug-in on the event dashboard', () => {
  let admin: APIRequestContext;
  let wasEnabled = false;
  let seeded: SeededProposals;

  test.beforeAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    admin = await request.newContext({
      baseURL: CLIENT_URL,
      storageState: ADMIN_STORAGE_STATE,
    });
    wasEnabled = await moduleEnabled(admin);
    await setModule(admin, true);
    seeded = await seedProposals(fixtureLabel(test.info().project.name));
  });

  test.afterAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    try {
      if (seeded) await removeProposals(seeded);
      await closeProposalDatabase();
    } finally {
      // In a `finally`: a cleanup that throws before restoring the flag leaves
      // the plug-in on for every later suite, and two other suites ask what
      // this instance mounts.
      await setModule(admin, wasEnabled);
      await admin.dispose();
    }
  });

  const dashboard = (): string =>
    `/series/${seeded.seriesId}/events/${seeded.eventId}`;

  const section = (page: import('@playwright/test').Page) =>
    page.locator('trefaro-plugin-program-proposals');

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
      .filter({ hasText: t('plugins.programProposals.label') });
    const link = tile.getByRole('link');
    await expect(link).toHaveAttribute(
      'href',
      new RegExp(`#plugin-${PLUGIN_KEY}$`),
    );
    // The glyph the descriptor names, from this instance's own files (E49).
    expect(await link.locator('svg path').getAttribute('d')).toMatch(/^M/);
    // And no number on it: the count belongs to the section below.
    await expect(tile.locator('.tile__value')).toHaveCount(0);

    // The element the tile points at, mounted by the host at the new hook
    // point, with the id the slot puts on it.
    await expect(section(page)).toBeAttached();
    await expect(section(page)).toHaveAttribute('id', `plugin-${PLUGIN_KEY}`);
    await expectNoRawKeys(page);
  });

  test('draws the counts and the queue in its own section', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto(dashboard());
    const panel = section(page);
    await expect(panel).toContainText(t('plugins.programProposals.moderation'));

    // Two waiting, nothing decided — the numbers the plug-in fetched itself.
    const counts = panel.locator('.count');
    await expect(counts).toHaveCount(3);
    await expect(counts.nth(0)).toContainText('2');
    await expect(counts.nth(0)).toContainText(
      t('plugins.programProposals.statusPending'),
    );
    await expect(counts.nth(1)).toContainText('0');

    // What approving does, said where the button is (E52).
    await expect(panel).toContainText(
      t('plugins.programProposals.approvalNote'),
    );

    for (const title of seeded.titles) {
      await expect(
        panel.locator('.row').filter({ hasText: title }),
      ).toBeVisible();
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
    const first = panel.locator('.row').filter({ hasText: seeded.titles[0] });
    await expect(first).toBeVisible();

    await first
      .getByRole('button', { name: t('plugins.programProposals.approve') })
      .click();

    // The queue is one shorter and the counts have moved — the section read
    // itself again rather than editing its own numbers.
    await expect(
      panel.locator('.row').filter({ hasText: seeded.titles[0] }),
    ).toHaveCount(0);
    await expect(panel.locator('.count').nth(0)).toContainText('1');
    await expect(panel.locator('.count').nth(1)).toContainText('1');
    // Still waiting: the second one, untouched by the first click.
    await expect(
      panel.locator('.row').filter({ hasText: seeded.titles[1] }),
    ).toBeVisible();

    // And in the database, which is the only place that settles it.
    expect(await proposalStates(seeded.eventId)).toEqual({
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
    const second = panel.locator('.row').filter({ hasText: seeded.titles[1] });
    await expect(second).toBeVisible();

    await second
      .getByRole('button', { name: t('plugins.programProposals.reject') })
      .click();

    await expect(panel).toContainText(t('plugins.programProposals.queueEmpty'));
    await expect(panel.locator('.count').nth(2)).toContainText('1');

    // Rejected, not deleted: the row keeps showing its status to whoever wrote
    // it, and a refusal that removed it would look like a submission that
    // never arrived.
    expect(await proposalStates(seeded.eventId)).toEqual({
      approved: 1,
      rejected: 1,
    });
  });

  test('takes tile and section away when it is switched off', async ({
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
        page
          .getByRole('article')
          .filter({ hasText: t('plugins.programProposals.label') }),
      ).toHaveCount(0);
      // The event's own tiles are untouched: a plug-in leaving takes nothing
      // of the dashboard with it.
      await expect(
        page.getByRole('article').filter({ hasText: t('admin.program.title') }),
      ).toBeVisible();
    } finally {
      await setModule(admin, true);
    }

    // And no row was lost while the switch was off (E14).
    expect(await proposalStates(seeded.eventId)).toEqual({
      approved: 1,
      rejected: 1,
    });
  });
});
