import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
import {
  sessionHeader,
  signInWithSeededSession,
} from './support/participant-session';
import {
  closeSeedDatabase,
  deleteProfiles,
  seedProfile,
  seedSession,
} from './support/registration-seed';
import {
  asAdmin,
  PUBLISHED_SERIES,
  UPCOMING_EVENT,
} from './support/series-fixtures';

/**
 * Proposing a session in a browser (FR 3.13, FR 3.14) — AP 3 of phase 4.
 *
 * The half of the package's acceptance criterion that belongs to the
 * participant, walked for real: a bundle is fetched at runtime, its element
 * mounted at the event detail hook point, a proposal typed into it, and the row
 * found again with its status. The organizer's dashboard — the tile, the
 * section and the two buttons — is `apps/admin-client-e2e`, because it is a
 * different client on a different address; the approval below therefore goes
 * through the API, and what this file decides is what the *participant* sees
 * before and after it.
 *
 * Three things only a browser can decide here:
 *
 * - that the element is mounted for **everybody** and invites a visitor without
 *   a session to log in (E58) — a section that appeared only to those already
 *   logged in would be a feature nobody hears about;
 * - that the visibility rule of E51 holds all the way to the screen: a second
 *   participant does not see a pending proposal, and does see it once it has
 *   been approved;
 * - that switching the plug-in off takes the tile **and** the section away
 *   without losing a row (E14).
 *
 * **Chromium only, and it restores what it found.** This file switches
 * `program-proposals`, and `module_config` is one table the whole instance
 * reads while Playwright runs three engines (`docs/rules/e2e-tests.md`). It is
 * the third switch a browser suite of this repository throws, after `push` in
 * the organizer client and `newsletter-opt-in` here.
 *
 * **No login at all** (F164): the participant login allows twenty attempts per
 * five minutes for the whole instance and the suites here already use
 * nineteen, so both accounts are seeded and the browser is handed the cookie a
 * login would have set. Neither of them is in the participant directory
 * (`searchable` false), which is the point: an author is named because they put
 * their name on something, not because they opted into being found (E37).
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4200';

const PLUGIN_KEY = 'program-proposals';

/** This file's own domain, so its teardown cannot take another suite's rows. */
const ADDRESS_DOMAIN = '@proposals-e2e.example.org';

const eventPath = `/series/${PUBLISHED_SERIES.slug}/events/${UPCOMING_EVENT.slug}`;

/** What this run proposes, so the row is this run's and nobody else's. */
const PROPOSAL_TITLE = `E2E a workshop on counting ${process.pid}`;
const PROPOSAL_BODY = 'Half a day, hands on, and it needs a room with tables.';

interface Person {
  readonly id: string;
  readonly session: string;
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

async function seedPerson(
  email: string,
  firstName: string,
  lastName: string,
): Promise<Person> {
  const id = await seedProfile({ email, firstName, lastName });
  return { id, session: await seedSession(id) };
}

test.describe.configure({ mode: 'serial' });

test.describe('the programme proposals plug-in on an event page', () => {
  let admin: APIRequestContext;
  let wasEnabled = false;
  let eventId = '';
  let author: Person;
  let bystander: Person;

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

    // From the public endpoint the landing page itself reads: the plug-in's
    // routes are keyed on the event's id, and the fixture only knows its slug.
    const event: { id: string } = await (
      await admin.get(
        `/api/user/series/${PUBLISHED_SERIES.slug}/events/${UPCOMING_EVENT.slug}`,
      )
    ).json();
    eventId = event.id;

    author = await seedPerson(
      `author.${process.pid}${ADDRESS_DOMAIN}`,
      'Amina',
      `Okonkwo${process.pid}`,
    );
    bystander = await seedPerson(
      `bystander.${process.pid}${ADDRESS_DOMAIN}`,
      'Jonas',
      `Weber${process.pid}`,
    );
  });

  test.afterAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    try {
      // The proposals go with their authors: `author_id` cascades, which is
      // what makes deleting the two accounts enough (F21 does not mean a
      // plug-in's rows outlive the people in them).
      await deleteProfiles(ADDRESS_DOMAIN);
      await closeSeedDatabase();
    } finally {
      // In a `finally`, because the flag is the part that matters: a cleanup
      // that throws before restoring it leaves the plug-in on for every later
      // suite, and `start-up.spec.ts` asks what this hook point mounts.
      await setModule(admin, wasEnabled);
      await admin.dispose();
    }
  });

  test('is mounted for everybody and invites a visitor to log in (E58)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto(eventPath);

    const element = page.locator('trefaro-plugin-program-proposals');
    await expect(element).toBeAttached();
    // Assigned by the slot, because the tile below links to it (FR 1.5).
    await expect(element).toHaveAttribute('id', `plugin-${PLUGIN_KEY}`);
    await expect(element).toContainText(t('plugins.programProposals.signIn'));
    // No form for somebody who could not use it, and no error either: a
    // section that reported a problem would look broken rather than closed.
    await expect(element).not.toContainText(
      t('plugins.programProposals.formTitle'),
    );

    const tile = page
      .locator('a.tile')
      .filter({ hasText: t('plugins.programProposals.label') });
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute(
      'href',
      new RegExp(`#plugin-${PLUGIN_KEY}$`),
    );
    // The glyph its descriptor names, drawn from this instance's own files.
    expect(await tile.locator('svg path').getAttribute('d')).toMatch(/^M/);
    await expectNoRawKeys(page);
  });

  test('takes a proposal and shows it back with its status (FR 3.13)', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    // A phone: this panel sits in a page a participant reads on one, and the
    // participant client is mobile-first.
    await page.setViewportSize({ width: 390, height: 844 });
    await signInWithSeededSession(context, CLIENT_URL, author.session);

    await page.goto(eventPath);
    const element = page.locator('trefaro-plugin-program-proposals');
    await expect(element).toContainText(
      t('plugins.programProposals.formTitle'),
    );

    await element.locator('input[name="title"]').fill(PROPOSAL_TITLE);
    await element.locator('textarea[name="description"]').fill(PROPOSAL_BODY);
    await element
      .getByRole('button', { name: t('plugins.programProposals.submit') })
      .click();

    await expect(element).toContainText(
      t('plugins.programProposals.submitted'),
    );
    const row = element.locator('.row').filter({ hasText: PROPOSAL_TITLE });
    await expect(row).toBeVisible();
    // The status is on the row, which is FR 3.14's promise to whoever
    // submitted something.
    await expect(row.locator('.chip')).toContainText(
      t('plugins.programProposals.statusPending'),
    );
    // And whose it is, by name — resolved through the host port, from an
    // account that is not in the directory (E37, F55).
    await expect(row).toContainText(`Okonkwo${process.pid}`);
    await expect(element).not.toContainText('@');

    // Nothing wider than the phone: a panel that sticks out sideways is
    // invisibly broken on a desktop.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    // It is the server's row now, not the panel's memory of a click.
    await page.reload();
    await expect(
      element.locator('.row').filter({ hasText: PROPOSAL_TITLE }),
    ).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('keeps it from a second participant until it is approved (E51)', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await signInWithSeededSession(context, CLIENT_URL, bystander.session);

    await page.goto(eventPath);
    const element = page.locator('trefaro-plugin-program-proposals');
    // Wait for something that is there before asserting something is not:
    // "invisible" is also true of a page that has not finished loading.
    await expect(element).toContainText(
      t('plugins.programProposals.formTitle'),
    );
    await expect(element).not.toContainText(PROPOSAL_TITLE);

    // The organizer's own click on this is `apps/admin-client-e2e`; here it is
    // the event the participant's screen has to react to.
    const queue: { rows: { id: string; title: string }[] } = await (
      await admin.get(
        `/api/admin/plugins/${PLUGIN_KEY}/events/${eventId}/proposals?status=pending`,
      )
    ).json();
    const mine = queue.rows.find((one) => one.title === PROPOSAL_TITLE);
    expect(mine).toBeDefined();
    const approval = await admin.post(
      `/api/admin/plugins/${PLUGIN_KEY}/proposals/${mine?.id}/approval`,
    );
    expect(approval.ok()).toBe(true);

    await page.reload();
    const row = element.locator('.row').filter({ hasText: PROPOSAL_TITLE });
    await expect(row).toBeVisible();
    // Approved is what a published proposal is, so there is no chip on it —
    // and the author's name is, because a proposal is attributed by nature.
    await expect(row.locator('.chip')).toHaveCount(0);
    await expect(row).toContainText(`Okonkwo${process.pid}`);
    await expect(element).not.toContainText('@');
    await expectNoRawKeys(page);
  });

  test('takes tile and section away when it is switched off, and loses nothing', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await setModule(admin, false);

    try {
      await page.goto(eventPath);
      // The page itself, first: the event's own heading is what says this page
      // arrived at all.
      await expect(
        page.getByRole('heading', { name: UPCOMING_EVENT.name }),
      ).toBeVisible();
      await expect(
        page.locator('trefaro-plugin-program-proposals'),
      ).toHaveCount(0);
      await expect(
        page
          .locator('a.tile')
          .filter({ hasText: t('plugins.programProposals.label') }),
      ).toHaveCount(0);
      // Switched off looks absent rather than forbidden, all the way down.
      expect(
        (
          await admin.get(
            `/api/admin/plugins/${PLUGIN_KEY}/events/${eventId}/proposals`,
          )
        ).status(),
      ).toBe(404);
    } finally {
      await setModule(admin, true);
    }

    // And the row is still there: switching a plug-in off never deletes
    // anything (E14).
    const back: { rows: { title: string }[] } = await (
      await admin.get(
        `/api/admin/plugins/${PLUGIN_KEY}/events/${eventId}/proposals`,
      )
    ).json();
    expect(back.rows.map((one) => one.title)).toContain(PROPOSAL_TITLE);

    // The author still sees it too, which is the same row from the other side.
    const mine = await admin.get(
      `/api/participant/plugins/${PLUGIN_KEY}/events/${eventId}/proposals`,
      { headers: sessionHeader(author.session) },
    );
    expect(mine.ok()).toBe(true);
  });
});
