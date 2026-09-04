import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './support/admin-session';
import { expectNoRawKeys, t } from './support/catalogue';
import {
  closeNewsletterDatabase,
  removeConsents,
  seedConsents,
  type SeededConsents,
} from './support/newsletter-fixtures';

/**
 * The newsletter opt-in administration in the browser (FR 4.8, E45) — AP 12.
 *
 * The acceptance criterion's third part, which only a screen can show: that the
 * overview **says which address comes from the registration form and which
 * from the app**. The other two — that a sign-up counts only after the click,
 * and that a session can cancel its own registration — belong to the
 * participant client's suite and to `apps/server-e2e`.
 *
 * Chromium only, and it restores what it found: this suite switches
 * `newsletter-opt-in`, and `module_config` is one table three browsers share
 * (the rule of `docs/rules/e2e-tests.md`). The module is **off by default**, so
 * a suite that did not switch it on would be testing an empty page and would
 * think it passed.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

const MODULE_KEY = 'newsletter-opt-in';

let sequence = 0;

function fixtureLabel(engine: string): string {
  sequence += 1;
  return `${engine}-${process.pid}-${sequence}`;
}

async function moduleEnabled(page: Page): Promise<boolean> {
  const response = await page.request.get('/api/admin/modules');
  expect(response.ok()).toBe(true);
  const modules: { key: string; enabled: boolean }[] = await response.json();
  return modules.find((one) => one.key === MODULE_KEY)?.enabled ?? false;
}

async function setModule(page: Page, enabled: boolean): Promise<void> {
  const response = await page.request.patch(
    `/api/admin/modules/${MODULE_KEY}`,
    {
      data: { enabled },
    },
  );
  expect(response.ok()).toBe(true);
}

async function openNewsletter(page: Page): Promise<void> {
  await page.goto('/newsletter');
  await expect(
    page.getByRole('heading', { level: 1, name: t('admin.newsletter.title') }),
  ).toBeVisible();
}

/** The row of one address, found by the cell that holds it. */
function row(page: Page, email: string) {
  return page
    .locator('tbody tr')
    .filter({ has: page.getByRole('cell', { name: email, exact: true }) });
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

test.describe('the newsletter overview', () => {
  let seeded: SeededConsents;
  let wasEnabled = false;

  /**
   * Chromium in the hooks too, not only in the tests.
   *
   * A `test.skip` inside a test body skips that body; the hooks run once per
   * engine regardless. Three engines reading and restoring one flag means the
   * first to finish puts it back while the others are still working — and the
   * one that then reads its own overview gets a 404 from its own teardown.
   */
  test.beforeAll(async ({ browser, browserName }) => {
    if (browserName !== 'chromium') return;
    const page = await browser.newPage({ storageState: ADMIN_STORAGE_STATE });
    try {
      wasEnabled = await moduleEnabled(page);
      await setModule(page, true);
    } finally {
      await page.close();
    }
    seeded = await seedConsents(fixtureLabel('admin'));
  });

  test.afterAll(async ({ browser, browserName }) => {
    if (browserName !== 'chromium') return;
    try {
      await removeConsents(seeded);
      await closeNewsletterDatabase();
    } finally {
      // In a `finally`: a cleanup that throws before the flag is restored
      // leaves the module on for every later suite (the lesson of AP 11, and
      // this file learned it again the hard way).
      const page = await browser.newPage({ storageState: ADMIN_STORAGE_STATE });
      try {
        await setModule(page, wasEnabled);
      } finally {
        await page.close();
      }
    }
  });

  test('is reached from the navigation while the module is on', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await page.goto('/');
    await page
      .getByRole('link', { name: t('admin.newsletter.title'), exact: true })
      .click();

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: t('admin.newsletter.title'),
      }),
    ).toBeVisible();
    // The sentence without which a list of addresses and no send button reads
    // like a feature that is missing (F8).
    await expect(page.getByText(t('admin.newsletter.noSending'))).toBeVisible();
    await expectNoRawKeys(page);
  });

  test('names the source of every address (E45)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await openNewsletter(page);

    // By cell rather than by row text: the source column is the one thing this
    // screen exists to say, and "the row mentions it somewhere" would also pass
    // if the two labels were swapped.
    await expect(
      row(page, seeded.formEmail).getByRole('cell', {
        name: t('admin.newsletter.sourceForm'),
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      row(page, seeded.appEmail).getByRole('cell', {
        name: t('admin.newsletter.sourceApp'),
        exact: true,
      }),
    ).toBeVisible();
    // And the series each consent is about, by name.
    await expect(row(page, seeded.appEmail)).toContainText(seeded.seriesName);
  });

  test('shows nobody who has not confirmed (E45)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await openNewsletter(page);

    // The row exists; it is not a consent, so it is on no list. That is the
    // whole worth of the double opt-in.
    await expect(row(page, seeded.pendingEmail)).toHaveCount(0);
  });

  test('offers to take back only what it can (E45)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    await openNewsletter(page);

    await expect(
      row(page, seeded.formEmail).getByRole('button', {
        name: t('admin.common.delete'),
      }),
    ).toHaveCount(0);
    await expect(
      row(page, seeded.formEmail).getByText(
        t('admin.newsletter.inRegistration'),
      ),
    ).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await row(page, seeded.appEmail)
      .getByRole('button', { name: t('admin.common.delete') })
      .click();

    // Gone from the list, and gone from the table behind it: a withdrawn
    // consent is not archived (E45).
    await expect(row(page, seeded.appEmail)).toHaveCount(0);
  });

  test('is absent from the navigation while the module is off (F142)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'switches the shared module_config');

    try {
      await setModule(page, false);
      await page.goto('/');

      // A menu entry to a page that says "switched off" is a menu entry to
      // nothing.
      await expect(
        page.getByRole('link', {
          name: t('admin.newsletter.title'),
          exact: true,
        }),
      ).toHaveCount(0);

      // The page itself stays reachable by address and says what to do.
      await openNewsletter(page);
      await expect(
        page.getByText(t('admin.newsletter.moduleOff')),
      ).toBeVisible();
    } finally {
      await setModule(page, true);
    }
  });
});
