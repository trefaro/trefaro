import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
import { newsletterPathFrom, waitForMailTo } from './support/mail';
import {
  closeSeedDatabase,
  deleteNewsletterSubscriptions,
} from './support/registration-seed';
import { asAdmin } from './support/series-fixtures';

/**
 * Signing up for the newsletter, in a browser (FR 4.8, E45) — AP 12.
 *
 * The acceptance criterion of the package's second half, and the reason it
 * needs a browser and a mailbox rather than a contract test: **a sign-up counts
 * only after the click in the mailbox**. So the link is read out of Mailpit and
 * opened, rather than minted here — what could quietly not work is not the
 * endpoint but the link leaving the server and pointing at a page that exists.
 *
 * Chromium only, and it restores what it found: this suite switches
 * `newsletter-opt-in`, and `module_config` is one table the whole instance
 * reads while Playwright runs three browsers (`docs/rules/e2e-tests.md`). The
 * module is off by default — a suite that did not switch it on would find no
 * form and conclude that it passed.
 *
 * The address carries the engine and the process, like every fixture here: an
 * address is unique instance-wide, and three engines racing on one would take
 * each other's mail.
 *
 * **Four posts to the sign-up route**, and that number is counted on: the route
 * allows twenty per five minutes and client address (E4), the contract suite in
 * `apps/server-e2e` spends ten of them, and both suites run against one server
 * inside one window. Whoever adds a sign-up here adds up first
 * (`docs/rules/e2e-tests.md`).
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4200';

const MODULE_KEY = 'newsletter-opt-in';

/** This file's own domain, so its teardown cannot take another suite's rows. */
const ADDRESS_DOMAIN = '@newsletter-e2e.example.org';

let sequence = 0;

function address(): string {
  sequence += 1;
  return `newsletter.${process.pid}.${sequence}${ADDRESS_DOMAIN}`;
}

async function moduleEnabled(context: APIRequestContext): Promise<boolean> {
  const modules: { key: string; enabled: boolean }[] = await (
    await context.get('/api/admin/modules')
  ).json();
  return modules.find((one) => one.key === MODULE_KEY)?.enabled ?? false;
}

async function setModule(
  context: APIRequestContext,
  enabled: boolean,
): Promise<void> {
  const response = await context.patch(`/api/admin/modules/${MODULE_KEY}`, {
    data: { enabled },
  });
  expect(response.ok()).toBe(true);
}

/**
 * One worker for the whole file, because it holds one flag.
 *
 * `fullyParallel` is on in the Nx preset, so without this the tests of this
 * file are handed to several workers — and every worker runs `beforeAll` and
 * `afterAll` of its own. Three of them reading and restoring one module switch
 * means the first to finish puts it back while the others are still working,
 * which is exactly how this file first answered its own teardown with a 404.
 */
test.describe.configure({ mode: 'serial' });

test.describe('the newsletter sign-up', () => {
  let admin: APIRequestContext;
  let wasEnabled = false;

  /**
   * Chromium in the hooks as well, not only in the tests.
   *
   * A `test.skip` inside a test body skips that body — the hooks around it
   * still run, once per engine. Three of them reading and restoring one flag
   * means the first to finish puts it back while the others are still working,
   * which is how the first run of this file left the module off underneath
   * itself and answered its own teardown with a 404.
   */
  test.beforeAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    admin = await asAdmin(CLIENT_URL);
    wasEnabled = await moduleEnabled(admin);
    await setModule(admin, true);
  });

  test.afterAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    try {
      // Every address this suite typed, confirmed or not — by SQL, because the
      // API cannot reach the unconfirmed ones: the overview lists consents
      // only (E45). A confirmed one left behind would sit in every later run's
      // overview, whose numbers its own suite asserts; an unconfirmed one
      // would sit there for good, invisible to everything.
      await deleteNewsletterSubscriptions(ADDRESS_DOMAIN);
      await closeSeedDatabase();
    } finally {
      // In a `finally`, because the flag is the part that matters: a cleanup
      // that throws before restoring it leaves the module on for every later
      // suite — and the first run of this file did exactly that. The rule from
      // AP 11 ("a suite may only restore what it read") needs this second half.
      await setModule(admin, wasEnabled);
      await admin.dispose();
    }
  });

  test('counts only after the link in the mail is used (E45)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    const email = address();

    await page.goto('/');
    const form = page.getByRole('region', { name: t('newsletter.title') });
    await expect(form).toBeVisible();

    await form.getByLabel(t('newsletter.email')).fill(email);
    await form.getByRole('button', { name: t('newsletter.submit') }).click();

    // One sentence for every outcome, because the server answers the same way
    // for a new address, an unconfirmed one and one that is already on the list
    // (E45, E32).
    await expect(page.getByText(t('newsletter.done'))).toBeVisible();
    await expectNoRawKeys(page);

    // Nothing is on any list yet: the row is stored and unconfirmed.
    const before: { rows: { email: string }[] } = await (
      await admin.get('/api/admin/newsletter?pageSize=200')
    ).json();
    expect(before.rows.map((row) => row.email)).not.toContain(email);

    const mail = await waitForMailTo(email);
    await page.goto(newsletterPathFrom(mail));

    // The page does not confirm on its own — a prefetching mail scanner must
    // not be able to give a consent on somebody's behalf (E5b).
    const after: { rows: { email: string }[] } = await (
      await admin.get('/api/admin/newsletter?pageSize=200')
    ).json();
    expect(after.rows.map((row) => row.email)).not.toContain(email);

    await page
      .getByRole('button', { name: t('newsletter.confirm.submit') })
      .click();
    await expect(page.getByText(t('newsletter.confirm.done'))).toBeVisible();

    const listed: {
      rows: { email: string; source: string; seriesId: string | null }[];
    } = await (await admin.get('/api/admin/newsletter?pageSize=200')).json();
    expect(listed.rows.find((row) => row.email === email)).toMatchObject({
      source: 'app',
      seriesId: null,
    });
  });

  test('signs up for the series whose page it is on', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    const email = address();

    // The published fixture series of this suite — its own page, so its own
    // list (E45).
    await page.goto('/');
    await page.locator('.series__link').first().click();
    const form = page.getByRole('region', { name: t('newsletter.title') });
    await expect(form).toBeVisible();

    await form.getByLabel(t('newsletter.email')).fill(email);
    await form.getByRole('button', { name: t('newsletter.submit') }).click();
    await expect(page.getByText(t('newsletter.done'))).toBeVisible();

    const mail = await waitForMailTo(email);
    await page.goto(newsletterPathFrom(mail));
    await page
      .getByRole('button', { name: t('newsletter.confirm.submit') })
      .click();
    await expect(page.getByText(t('newsletter.confirm.done'))).toBeVisible();

    const listed: {
      rows: { email: string; seriesId: string | null }[];
    } = await (await admin.get('/api/admin/newsletter?pageSize=200')).json();
    // A series, not the instance: which one is the organizer's business, but
    // that it is one is this test's.
    expect(listed.rows.find((row) => row.email === email)?.seriesId).toEqual(
      expect.any(String),
    );
  });

  test('says the same thing again for an address already on the list', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');
    const email = address();

    await page.goto('/');
    const form = page.getByRole('region', { name: t('newsletter.title') });
    await form.getByLabel(t('newsletter.email')).fill(email);
    await form.getByRole('button', { name: t('newsletter.submit') }).click();
    await expect(page.getByText(t('newsletter.done'))).toBeVisible();

    await page.reload();
    const again = page.getByRole('region', { name: t('newsletter.title') });
    await again.getByLabel(t('newsletter.email')).fill(email);
    await again.getByRole('button', { name: t('newsletter.submit') }).click();

    // The screen cannot say "you are already signed up", because the server
    // deliberately did not tell it (E32).
    await expect(page.getByText(t('newsletter.done'))).toBeVisible();
  });

  test('is not offered while the module is off (F142)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    try {
      await setModule(admin, false);
      await page.goto('/');
      // The client reads the module list once at startup, so this page load is
      // the one that matters — not a redraw.
      await expect(
        page.getByRole('region', { name: t('newsletter.title') }),
      ).toHaveCount(0);
    } finally {
      await setModule(admin, true);
    }
  });
});
