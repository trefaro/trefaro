import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
import { signInWithSeededSession } from './support/participant-session';
import {
  removePersonalPlan,
  seedPersonalPlan,
  type SeededPersonalPlan,
} from './support/personal-plan-fixtures';
import {
  closeSeedDatabase,
  deleteProfiles,
  seedProfile,
  seedSession,
} from './support/registration-seed';
import { asAdmin } from './support/series-fixtures';

/**
 * A participant builds their own programme (FR 3.17) — AP 9 of phase 4.
 *
 * The package's acceptance criterion, walked for real: a bundle is fetched at
 * runtime, its element mounted at the event detail hook point, sessions ticked
 * and un-ticked on a phone, and the number the programme shows checked
 * afterwards. What only a browser can decide here:
 *
 * - that the element is mounted for **everybody** and invites a visitor without
 *   a session to log in (E58), while the tile above it points at the section;
 * - that ticking a session **books no seat** — read back off the public
 *   programme, where the count is what somebody deciding whether to come sees
 *   (E55, F201). The section says where a seat *is* booked, in both shapes
 *   F42 allows;
 * - that the plan survives a reload, because it is the server's and not the
 *   browser's;
 * - that a **language switch reaches the titles**: they are translated on the
 *   server (E56), so the section asks again — without a reload, without the
 *   element being replaced, and without losing the filter the reader set;
 * - that switching the plug-in off takes the tile **and** the section away
 *   without losing a plan (E14).
 *
 * **Chromium only, and it restores what it found.** This file switches
 * `personal-program`, and `module_config` is one table the whole instance reads
 * while Playwright runs three engines (`docs/rules/e2e-tests.md`).
 *
 * **No login at all** (F164): the account is seeded and the browser is handed
 * the cookie a login would have set.
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4200';

const PLUGIN_KEY = 'personal-program';

/** This file's own domain, so its teardown cannot take another suite's rows. */
const ADDRESS_DOMAIN = '@personal-plan-e2e.example.org';

interface PublicItem {
  id: string;
  title: string;
  registrationEnabled: boolean;
  capacity: number | null;
  signupCount: number;
}

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

test.describe('the personal programme plug-in on an event page', () => {
  let admin: APIRequestContext;
  /** `null` until read: a crash before the read must not write a guess. */
  let wasEnabled: boolean | null = null;
  let seeded: SeededPersonalPlan;
  let session = '';

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
    await setModule(admin, true);
    seeded = await seedPersonalPlan(admin, `${process.pid}`);
    session = await seedSession(
      await seedProfile({
        email: `planner${process.pid}${ADDRESS_DOMAIN}`,
        firstName: 'Amina',
        lastName: 'Okonkwo',
      }),
    );
  });

  test.afterAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    try {
      if (seeded) await removePersonalPlan(admin, seeded);
      await deleteProfiles(ADDRESS_DOMAIN);
    } finally {
      if (wasEnabled !== null) await setModule(admin, wasEnabled);
      await admin.dispose();
      await closeSeedDatabase();
    }
  });

  const eventPath = (): string =>
    `/series/${seeded.seriesSlug}/events/${seeded.eventSlug}`;

  const section = (page: Page) =>
    page.locator('trefaro-plugin-personal-program');

  /** The card of one session, found by the title it shows. */
  const sessionNamed = (page: Page, title: string) =>
    section(page)
      .locator('.session')
      .filter({ has: page.locator('.session__title', { hasText: title }) });

  const word = (key: string, locale?: string): string =>
    locale
      ? t(`plugins.personalProgram.${key}`, {}, locale)
      : t(`plugins.personalProgram.${key}`);

  const publicProgram = async (): Promise<PublicItem[]> =>
    (
      await admin.get(
        `/api/user/series/${seeded.seriesSlug}/events/${seeded.eventSlug}/program`,
      )
    ).json();

  test('is mounted for everybody and invites a visitor to log in (E58)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    // No session at all: a visitor who followed a link.
    await page.goto(eventPath());
    const element = section(page);
    await expect(element).toBeAttached();
    await expect(element).toHaveAttribute('id', `plugin-${PLUGIN_KEY}`);
    await expect(element).toContainText(word('signIn'));
    // A section that appeared only to those already logged in would be a
    // feature nobody hears about.
    await expect(element.locator('.session')).toHaveCount(0);

    const tile = page.locator('a.tile').filter({ hasText: word('label') });
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute('href', /#plugin-personal-program$/);
    // The glyph the descriptor has named since AP 1 (E49).
    expect(
      await tile.locator('.tile__icon svg path').getAttribute('d'),
    ).toMatch(/^M/);
    await expectNoRawKeys(page);
  });

  test('draws the whole programme by day, and says where a seat is booked — on a phone', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await signInWithSeededSession(context, CLIENT_URL, session);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(eventPath());
    const element = section(page);
    await expect(element.locator('.session__title')).toHaveText([
      seeded.plenaryTitle,
      seeded.workshopTitle,
      seeded.openSpaceTitle,
    ]);
    // Two days, three sessions: the second day has a heading of its own.
    await expect(element.locator('.day')).toHaveCount(2);

    // Both shapes of FR 3.10 (F42) and the one that asks nothing.
    await expect(
      sessionNamed(page, seeded.plenaryTitle).locator('.session__seats'),
    ).toHaveCount(0);
    const workshop = sessionNamed(page, seeded.workshopTitle).locator(
      '.session__seats',
    );
    await expect(workshop).toContainText(word('signupNote'));
    await expect(workshop).toContainText(word('limited'));
    const openSpace = sessionNamed(page, seeded.openSpaceTitle).locator(
      '.session__seats',
    );
    await expect(openSpace).toContainText(word('signupNote'));
    await expect(openSpace).not.toContainText(word('limited'));
    // The number of seats stays out: without how many are taken it reads as
    // "still free", which is a promise this plug-in cannot keep. Asserted on
    // the mark rather than on the section, because the fixture's own label is
    // a process id and may contain any digits at all.
    await expect(workshop).not.toContainText('12');
    await expect(openSpace).not.toContainText('12');

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

  test('takes a session into the plan and books no seat (E55)', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await signInWithSeededSession(context, CLIENT_URL, session);

    await page.goto(eventPath());
    const workshop = sessionNamed(page, seeded.workshopTitle);
    await workshop.getByRole('button', { name: word('add') }).click();

    await expect(
      workshop.getByRole('button', { name: word('remove') }),
    ).toBeVisible();
    await expect(workshop).toContainText(word('inPlan'));

    // The assertion this whole plug-in exists to survive: the number somebody
    // deciding whether to come sees has not moved.
    const programme = await publicProgram();
    expect(programme.map((item) => item.signupCount)).toEqual([0, 0, 0]);
    expect(
      programme.find((item) => item.id === seeded.workshopId)?.capacity,
    ).toBe(12);

    // It is the server's plan, not the browser's: a reload keeps it.
    await page.reload();
    await expect(
      sessionNamed(page, seeded.workshopTitle).getByRole('button', {
        name: word('remove'),
      }),
    ).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('shows only the plan when asked, and gives the programme back', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await signInWithSeededSession(context, CLIENT_URL, session);

    await page.goto(eventPath());
    const element = section(page);
    await expect(element.locator('.session')).toHaveCount(3);

    await element.getByRole('button', { name: word('onlyMine') }).click();
    await expect(element.locator('.session')).toHaveCount(1);
    await expect(element.locator('.session__title')).toHaveText([
      seeded.workshopTitle,
    ]);

    await element.getByRole('button', { name: word('whole') }).click();
    await expect(element.locator('.session')).toHaveCount(3);
    await expectNoRawKeys(page);
  });

  test('follows a language switch without a reload, translated and with the filter kept (E56)', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await signInWithSeededSession(context, CLIENT_URL, session);

    await page.goto(eventPath());
    const element = section(page);
    await expect(element.locator('.session__title').first()).toHaveText(
      seeded.plenaryTitle,
    );
    await element.getByRole('button', { name: word('onlyMine') }).click();
    await expect(element.locator('.session')).toHaveCount(1);

    // Two sentinels: one on the window, so a reload would be noticed, and one
    // on the element itself, so a remount would be.
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>)['e2eStillHere'] = true;
      document
        .querySelector('trefaro-plugin-personal-program')
        ?.setAttribute('data-e2e-mounted-once', 'yes');
    });

    await page.getByRole('combobox').selectOption('de');

    // The words from the catalogue and the title from the translation table:
    // two different sources, one switch.
    await expect(element).toContainText(word('title', 'de'));
    await expect(element).toHaveAttribute('data-e2e-mounted-once', 'yes');
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>)['e2eStillHere'],
      ),
    ).toBe(true);
    // The words were reassigned, the element was not replaced — so what the
    // reader set is still set.
    await expect(element.locator('.session')).toHaveCount(1);

    await element.getByRole('button', { name: word('whole', 'de') }).click();
    await expect(element.locator('.session__title')).toHaveText([
      seeded.plenaryTitleDe,
      // Nobody translated the other two: the originals stay (F95).
      seeded.workshopTitle,
      seeded.openSpaceTitle,
    ]);
    await expectNoRawKeys(page);
  });

  test('takes a session out again, and cancels nothing', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await signInWithSeededSession(context, CLIENT_URL, session);

    await page.goto(eventPath());
    const workshop = sessionNamed(page, seeded.workshopTitle);
    await workshop.getByRole('button', { name: word('remove') }).click();

    await expect(
      workshop.getByRole('button', { name: word('add') }),
    ).toBeVisible();
    await expect(workshop).not.toContainText(word('inPlan'));
    expect(
      (await publicProgram()).every((item) => item.signupCount === 0),
    ).toBe(true);
    await expectNoRawKeys(page);
  });

  test('takes tile and section away when it is switched off, and keeps the plan (E14)', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await signInWithSeededSession(context, CLIENT_URL, session);

    // Something in the plan first, so there is something to lose.
    await page.goto(eventPath());
    await sessionNamed(page, seeded.plenaryTitle)
      .getByRole('button', { name: word('add') })
      .click();
    await expect(
      sessionNamed(page, seeded.plenaryTitle).getByRole('button', {
        name: word('remove'),
      }),
    ).toBeVisible();

    await setModule(admin, false);
    try {
      await page.goto(eventPath());
      // The page is still the page: an event does not depend on a plug-in.
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: /E2E Personal Plan Event/,
        }),
      ).toBeVisible();
      await expect(section(page)).toHaveCount(0);
      await expect(
        page.locator('a.tile').filter({ hasText: word('label') }),
      ).toHaveCount(0);
    } finally {
      await setModule(admin, true);
    }

    await page.goto(eventPath());
    // Disabling never deletes: what was ticked before is still ticked.
    await expect(
      sessionNamed(page, seeded.plenaryTitle).getByRole('button', {
        name: word('remove'),
      }),
    ).toBeVisible();
    await expectNoRawKeys(page);
  });
});
