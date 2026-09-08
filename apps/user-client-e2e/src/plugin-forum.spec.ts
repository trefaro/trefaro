import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
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
 * Two participants lead a thread in a browser (FR 4.6) — AP 5 of phase 4.
 *
 * The half of the package's acceptance criterion that belongs to the
 * participants, walked for real: a bundle is fetched at runtime, its element
 * mounted at the event detail hook point, a thread started in it on a phone,
 * and a second person replies once the first post is published. The
 * organizer's dashboard — the tile, the section and the two buttons — is
 * `apps/admin-client-e2e`, because it is a different client on a different
 * address; the approvals below therefore go through the API, and what this
 * file decides is what the *participants* see before and after each one.
 *
 * Four things only a browser can decide here:
 *
 * - that the element is mounted for **everybody** and invites a visitor without
 *   a session to log in (E58), and that the hook point does with **several**
 *   plug-ins what it does with one — one tile and one section per plug-in the
 *   configuration names;
 * - that the visibility rule of F195 holds all the way to the screen: a second
 *   participant does not see a thread until a post in it is approved, and a
 *   reply is the reader's own until it is approved too — post by post;
 * - that a thread opens **inside** the panel and the list is still there
 *   behind it;
 * - that switching the plug-in off takes the tile **and** the section away
 *   without losing a row (E14).
 *
 * **Chromium only, and it restores what it found.** This file switches
 * `forum`, and `module_config` is one table the whole instance reads while
 * Playwright runs three engines (`docs/rules/e2e-tests.md`).
 *
 * **No login at all** (F164): both accounts are seeded and the browser is
 * handed the cookie a login would have set. Neither of them is in the
 * participant directory (`searchable` false): an author is named because they
 * put their name on something, not because they opted into being found (E37).
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4200';

const PLUGIN_KEY = 'forum';

/** This file's own domain, so its teardown cannot take another suite's rows. */
const ADDRESS_DOMAIN = '@forum-e2e.example.org';

const eventPath = `/series/${PUBLISHED_SERIES.slug}/events/${UPCOMING_EVENT.slug}`;

/** What this run writes, so the rows are this run's and nobody else's. */
const THREAD_TITLE = `E2E where to meet before the workshop ${process.pid}`;
const FIRST_POST = `In front of the main entrance, at nine? ${process.pid}`;
const REPLY = `Nine is fine, I will bring the banner. ${process.pid}`;

interface Person {
  readonly id: string;
  readonly session: string;
}

interface ModeratedPost {
  id: string;
  body: string;
  status: string;
  thread: { id: string; title: string };
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

test.describe('the discussion forum plug-in on an event page', () => {
  let admin: APIRequestContext;
  /** `null` until read: a crash before the read must not write a guess. */
  let wasEnabled: boolean | null = null;
  let eventId = '';
  let opener: Person;
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

    opener = await seedPerson(
      `opener.${process.pid}${ADDRESS_DOMAIN}`,
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
      // The thread goes with its opener and the posts with their authors:
      // `created_by` and `author_id` cascade, which is what makes deleting the
      // two accounts enough.
      await deleteProfiles(ADDRESS_DOMAIN);
      await closeSeedDatabase();
    } finally {
      // In a `finally`, because the flag is the part that matters: a cleanup
      // that throws before restoring it leaves the plug-in on for every later
      // suite. Only what was read is put back.
      if (wasEnabled !== null) await setModule(admin, wasEnabled);
      await admin.dispose();
    }
  });

  const element = (page: Page) => page.locator('trefaro-plugin-forum');

  const threadRow = (page: Page) =>
    element(page).locator('.thread').filter({ hasText: THREAD_TITLE });

  /** The organizer's decision on one post, found by its body in the queue. */
  async function approvePost(body: string): Promise<void> {
    const queue: { rows: ModeratedPost[] } = await (
      await admin.get(
        `/api/admin/plugins/${PLUGIN_KEY}/events/${eventId}/posts?status=pending`,
      )
    ).json();
    const post = queue.rows.find((one) => one.body === body);
    expect(post, `no pending post "${body}"`).toBeDefined();
    const approval = await admin.post(
      `/api/admin/plugins/${PLUGIN_KEY}/posts/${post?.id}/approval`,
    );
    expect(approval.ok()).toBe(true);
  }

  test('is mounted for everybody and invites a visitor to log in (E58)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto(eventPath);

    await expect(element(page)).toBeAttached();
    // Assigned by the slot, because the tile below links to it (FR 1.5).
    await expect(element(page)).toHaveAttribute('id', `plugin-${PLUGIN_KEY}`);
    await expect(element(page)).toContainText(t('plugins.forum.signIn'));
    // No form for somebody who could not use it, and no error either: a
    // section that reported a problem would look broken rather than closed.
    await expect(element(page)).not.toContainText(t('plugins.forum.newThread'));

    const tile = page
      .locator('a.tile')
      .filter({ hasText: t('plugins.forum.label') });
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute(
      'href',
      new RegExp(`#plugin-${PLUGIN_KEY}$`),
    );
    // The glyph its descriptor names, drawn from this instance's own files.
    expect(await tile.locator('svg path').getAttribute('d')).toMatch(/^M/);
    await expectNoRawKeys(page);
  });

  test('does with every plug-in the configuration names what it does with one', async ({
    page,
    request,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto(eventPath);
    await expect(element(page)).toBeAttached();

    // Whatever is on right now — this file's plug-in at least, and whatever
    // another suite has switched on beside it — has one mounted element and
    // one tile pointing at it, in the order the plug-ins are registered.
    // Compared against the instance rather than a constant, because another
    // file may flip a switch while this one reads (`e2e-tests.md`).
    const configured = async (): Promise<string[]> => {
      const config: { plugins: { key: string; mountPoints: string[] }[] } =
        await (await request.get('/api/config')).json();
      return config.plugins
        .filter((plugin) => plugin.mountPoints.includes('event-detail'))
        .map((plugin) => plugin.key);
    };
    const mounted = (): Promise<(string | null)[]> =>
      page
        .locator('.trefaro-plugin-slot[data-mount-point="event-detail"] > *')
        .evaluateAll((elements) =>
          elements.map((one) => one.getAttribute('data-plugin')),
        );
    const linked = (): Promise<(string | null)[]> =>
      page
        .locator('a.tile[href*="#plugin-"]')
        .evaluateAll((anchors) =>
          anchors.map(
            (anchor) =>
              anchor.getAttribute('href')?.split('#plugin-').pop() ?? null,
          ),
        );

    await expect
      .poll(async () => {
        const [keys, inDom, inTiles] = await Promise.all([
          configured(),
          mounted(),
          linked(),
        ]);
        const same =
          keys.join(', ') === inDom.join(', ') &&
          keys.join(', ') === inTiles.join(', ');
        return same
          ? `one element and one tile for each of [${keys.join(', ')}]`
          : `configured [${keys.join(', ')}], mounted [${inDom.join(', ')}], tiles [${inTiles.join(', ')}]`;
      })
      .toMatch(/^one element and one tile for each of \[.*forum.*\]$/);
  });

  test('starts a thread on a phone and lands in it, with the first post pending', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    // A phone: this panel sits in a page a participant reads on one, and the
    // participant client is mobile-first.
    await page.setViewportSize({ width: 390, height: 844 });
    await signInWithSeededSession(context, CLIENT_URL, opener.session);

    await page.goto(eventPath);
    const panel = element(page);
    await expect(panel).toContainText(t('plugins.forum.newThread'));

    await panel.locator('input[name="title"]').fill(THREAD_TITLE);
    await panel.locator('textarea[name="body"]').fill(FIRST_POST);
    await panel.getByRole('button', { name: t('plugins.forum.open') }).click();

    // The screen after "open" is the thread itself: title, the one post with
    // its status, and the sentence about who sees it (F49, F195).
    await expect(panel.locator('.thread-view__title')).toHaveText(THREAD_TITLE);
    const post = panel.locator('.post').filter({ hasText: FIRST_POST });
    await expect(post).toBeVisible();
    await expect(post.locator('.chip')).toContainText(
      t('plugins.forum.statusPending'),
    );
    await expect(panel).toContainText(t('plugins.forum.posted'));
    await expect(panel).toContainText(t('plugins.forum.pendingNote'));
    // And whose it is, by name — resolved through the host port, from an
    // account that is not in the directory (E37, F55).
    await expect(post).toContainText(`Okonkwo${process.pid}`);
    await expect(panel).not.toContainText('@');

    // Nothing wider than the phone: a panel that sticks out sideways is
    // invisibly broken on a desktop.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    // The list is behind the thread, and going back costs no request.
    await panel.getByRole('button', { name: t('plugins.forum.back') }).click();
    await expect(threadRow(page)).toBeVisible();

    // It is the server's row now, not the panel's memory of a click: after a
    // reload the author still finds their unpublished thread (F195), and the
    // post in it.
    await page.reload();
    await expect(threadRow(page)).toBeVisible();
    await threadRow(page).click();
    await expect(
      panel.locator('.post').filter({ hasText: FIRST_POST }).locator('.chip'),
    ).toContainText(t('plugins.forum.statusPending'));
    await expectNoRawKeys(page);
  });

  test('keeps the thread from a second participant until its first post is approved, who then replies (F195)', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await signInWithSeededSession(context, CLIENT_URL, bystander.session);

    await page.goto(eventPath);
    const panel = element(page);
    // Wait for something that is there before asserting something is not:
    // "invisible" is also true of a page that has not finished loading.
    await expect(panel).toContainText(t('plugins.forum.newThread'));
    await expect(panel).not.toContainText(THREAD_TITLE);

    // The organizer's own click on this is `apps/admin-client-e2e`; here it is
    // the event the participant's screen has to react to.
    await approvePost(FIRST_POST);

    await page.reload();
    await expect(threadRow(page)).toBeVisible();
    await threadRow(page).click();
    const post = panel.locator('.post').filter({ hasText: FIRST_POST });
    await expect(post).toBeVisible();
    // Approved is what a published post is, so there is no chip on it — and
    // the author's name is, because a post is attributed by nature.
    await expect(post.locator('.chip')).toHaveCount(0);
    await expect(post).toContainText(`Okonkwo${process.pid}`);

    // The reply: appended, pending, and visible to its author with the chip.
    await panel.locator('textarea[name="body"]').fill(REPLY);
    await panel.getByRole('button', { name: t('plugins.forum.reply') }).click();
    const reply = panel.locator('.post').filter({ hasText: REPLY });
    await expect(reply).toBeVisible();
    await expect(reply.locator('.chip')).toContainText(
      t('plugins.forum.statusPending'),
    );
    await expect(reply).toContainText(`Weber${process.pid}`);
    await expect(panel).toContainText(t('plugins.forum.posted'));
    await expect(panel).not.toContainText('@');
    await expectNoRawKeys(page);
  });

  test('shows the reply to the opener only once it is approved as well (E51)', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    await signInWithSeededSession(context, CLIENT_URL, opener.session);

    await page.goto(eventPath);
    const panel = element(page);
    await threadRow(page).click();
    await expect(
      panel.locator('.post').filter({ hasText: FIRST_POST }),
    ).toBeVisible();
    // Post by post: the thread is published, the reply in it is not yet.
    await expect(panel).not.toContainText(REPLY);

    await approvePost(REPLY);

    await page.reload();
    await threadRow(page).click();
    const reply = panel.locator('.post').filter({ hasText: REPLY });
    await expect(reply).toBeVisible();
    await expect(reply.locator('.chip')).toHaveCount(0);
    await expect(reply).toContainText(`Weber${process.pid}`);
    // Two people, two names, and a conversation that reads top-down.
    await expect(panel.locator('.post__body')).toHaveText([FIRST_POST, REPLY]);
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
      await expect(element(page)).toHaveCount(0);
      await expect(
        page.locator('a.tile').filter({ hasText: t('plugins.forum.label') }),
      ).toHaveCount(0);
      // Switched off looks absent rather than forbidden, all the way down.
      expect(
        (
          await admin.get(
            `/api/admin/plugins/${PLUGIN_KEY}/events/${eventId}/posts`,
          )
        ).status(),
      ).toBe(404);
    } finally {
      await setModule(admin, true);
    }

    // And the rows are still there: switching a plug-in off never deletes
    // anything (E14).
    const back: { rows: ModeratedPost[] } = await (
      await admin.get(
        `/api/admin/plugins/${PLUGIN_KEY}/events/${eventId}/posts`,
      )
    ).json();
    const ours = back.rows.filter((one) => one.thread.title === THREAD_TITLE);
    expect(ours.map((one) => one.body).sort()).toEqual(
      [FIRST_POST, REPLY].sort(),
    );

    // The opener still sees it too, which is the same thread from the other
    // side.
    const mine: { rows: { title: string }[] } = await (
      await admin.get(
        `/api/participant/plugins/${PLUGIN_KEY}/events/${eventId}/threads`,
        { headers: sessionHeader(opener.session) },
      )
    ).json();
    expect(mine.rows.map((one) => one.title)).toContain(THREAD_TITLE);
  });
});
