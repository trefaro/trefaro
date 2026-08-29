import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { ADMIN_STORAGE_STATE } from './support/admin-session';
import { t } from './support/catalogue';

/**
 * The language administration in a browser (chapter 4) — AP 7.
 *
 * What only a browser can show: that an organizer can create a language, type a
 * translation into it, see the figure move, filter down to what is left, put a
 * key back to what the image ships, and carry the file out and in again. The
 * rules behind those actions are unit-tested; whether the screen actually does
 * them is this suite.
 *
 * Two things it deliberately does **not** touch:
 *
 * - **`app_config.active_locales`.** Offering a language is instance-wide state,
 *   and two other browser suites read the switcher while this one runs — a third
 *   option appearing mid-test would fail them. That half of the acceptance
 *   criterion is asserted in `apps/server-e2e/src/api/admin-i18n.spec.ts`, where
 *   one suite runs at a time.
 * - **A shipped language.** Every key of `en` and `de` is asserted somewhere, so
 *   the writes here go to a language nothing else knows: Occitan (`oc`), which is
 *   also not the tag the API contract suite uses.
 *
 * Even so it writes rows, so it runs in chromium only: three workers translating
 * the same key would each assert what another just replaced.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

const LOCALE = 'oc';

/**
 * Puts the language back to having no rows at all.
 *
 * It **asks** which keys have one rather than deleting every key of the
 * catalogue: since AP 8 that is a hundred and fifty requests, which took longer
 * than the whole test is allowed to take. Asking keeps the cheap case cheap and
 * the self-healing property that matters more — a run killed halfway leaves rows
 * behind, and a clean-up that only knows the keys *this* test wrote would leave
 * them there for the next run to trip over. Called before and after, because
 * "no rows" is this suite's precondition as much as its promise.
 */
async function resetLocale(page: Page): Promise<void> {
  const response = await page.request.get(`/api/admin/i18n/${LOCALE}`);
  if (!response.ok()) return;

  const detail = (await response.json()) as {
    entries: { key: string; state: string }[];
  };
  await Promise.all(
    detail.entries
      .filter((entry) => entry.state === 'overridden')
      .map((entry) =>
        page.request.delete(
          `/api/admin/i18n/${LOCALE}/${encodeURIComponent(entry.key)}`,
        ),
      ),
  );
}

/** The keys of the shipped catalogue, read from the instance rather than typed. */
async function shippedKeys(page: Page): Promise<string[]> {
  const response = await page.request.get('/api/i18n/en');
  return Object.keys((await response.json()) as Record<string, string>).sort();
}

test.describe('language administration', () => {
  test('lists the shipped languages with a completeness figure', async ({
    page,
  }) => {
    await page.goto('/languages');
    await expect(
      page.getByRole('heading', { level: 1, name: t('admin.languages.title') }),
    ).toBeVisible();

    const languages = page.getByRole('table', {
      name: t('admin.languages.title'),
    });
    const german = languages.getByRole('row').filter({ hasText: 'German' });
    await expect(german).toBeVisible();
    // English is the key list, so it is complete by definition (E23).
    await expect(
      languages
        .getByRole('row')
        .filter({ hasText: 'English' })
        .getByText('100%'),
    ).toBeVisible();
    await expect(german.getByText('100%')).toBeVisible();
  });

  // The two tests below write into the *same* language, so they must not
  // overlap. `test.skip(browserName !== 'chromium')` is not enough for that:
  // it stops the three engines from colliding, but Playwright runs a single
  // file's tests in parallel workers as well (`fullyParallel`), and locally
  // there is more than one. Both wrote `oc`'s first key and each asserted what
  // the other had just replaced. CI never saw it — it runs with one worker.
  test.describe('writing into a language', () => {
    test.describe.configure({ mode: 'serial' });

    test('creates a language, translates a key and moves the figure', async ({
      page,
      browserName,
    }) => {
      test.skip(
        browserName !== 'chromium',
        'writes translation_override rows — three engines would each assert ' +
          'what another just replaced',
      );
      const keys = await shippedKeys(page);
      const key = keys[0];
      await resetLocale(page);

      try {
        await page.goto('/languages');
        await page.getByLabel(t('admin.languages.addLanguage')).fill(LOCALE);
        await page
          .getByRole('button', { name: t('admin.languages.add'), exact: true })
          .click();

        // On the list at once, and at nought per cent: a language exists because
        // somebody translated it, and this is the moment before anybody has.
        // Through the labelled table: the editor's own header carries the
        // language's name too, so an unscoped row locator matches two things.
        const row = page
          .getByRole('table', { name: t('admin.languages.title') })
          .getByRole('row')
          .filter({ hasText: 'Occitan' });
        await expect(row).toBeVisible();
        // `exact`, because a substring match would find the 0 of "20%" later on.
        await expect(row.getByText('0%', { exact: true })).toBeVisible();
        await expect(row).toContainText(
          t('admin.languages.keysOf', { translated: 0, total: keys.length }),
        );

        // The editor opened by itself, on the language just added.
        const field = page.getByRole('textbox', { name: key });
        await expect(field).toBeVisible();
        await expect(field).toHaveValue('');
        await expect(
          page.getByText(t('admin.languages.state.missing')).first(),
        ).toBeVisible();

        await field.fill('Lenga occitana');
        await page
          .getByRole('button', {
            name: t('admin.languages.saveCount.one', { count: 1 }),
          })
          .click();

        await expect(page.getByRole('status')).toContainText(
          t('admin.languages.written', { count: 1 }),
        );
        // The figure the acceptance criterion asks about, counted rather than
        // rounded: since AP 9 the catalogue has hundreds of keys, so one of
        // them is a fraction of a per cent and the percentage still reads 0 %.
        // The count beside it is what makes the first translation visible —
        // which is why the page shows both.
        await expect(row).toContainText(
          t('admin.languages.keysOf', { translated: 1, total: keys.length }),
        );
        await expect(
          row.getByText(t('admin.languages.state.overridden')),
        ).toBeVisible();

        // Only what is left, which is what a translator works through.
        await page.getByLabel(t('admin.languages.onlyMissing')).check();
        await expect(page.getByRole('textbox', { name: key })).toBeHidden();
        await expect(
          page.getByRole('textbox', { name: keys[1] }),
        ).toBeVisible();
        await page.getByLabel(t('admin.languages.onlyMissing')).uncheck();

        // And back to what the image ships — which for a language the image does
        // not ship means back to nothing, so the key is untranslated again.
        await page
          .getByRole('button', { name: t('admin.languages.reset') })
          .click();
        await expect(page.getByRole('status')).toContainText(
          t('admin.languages.resetDone', { key }),
        );
        await expect(page.getByRole('textbox', { name: key })).toHaveValue('');
        await expect(row.getByText('0%', { exact: true })).toBeVisible();
      } finally {
        await resetLocale(page);
      }
    });

    test('carries the file out and back in again', async ({
      page,
      browserName,
    }) => {
      test.skip(
        browserName !== 'chromium',
        'writes translation_override rows, and asserts a download',
      );
      const keys = await shippedKeys(page);
      await resetLocale(page);

      try {
        await page.goto('/languages');
        await page.getByLabel(t('admin.languages.addLanguage')).fill(LOCALE);
        await page
          .getByRole('button', { name: t('admin.languages.add'), exact: true })
          .click();
        await expect(
          page.getByRole('textbox', { name: keys[0] }),
        ).toBeVisible();

        const download = await Promise.all([
          page.waitForEvent('download'),
          page
            .getByRole('button', { name: t('admin.languages.exportJson') })
            .click(),
        ]).then(([event]) => event);

        expect(download.suggestedFilename()).toBe(`trefaro-${LOCALE}.json`);
        const file = await download.path();
        const exported = JSON.parse(await readFile(file, 'utf8')) as Record<
          string,
          string
        >;

        // Every key, and every one empty: that is the honest picture of a
        // language nobody has translated, and it is what an import reads back as
        // "no translation of my own".
        expect(Object.keys(exported).sort()).toEqual(keys);
        expect(Object.values(exported).every((value) => value === '')).toBe(
          true,
        );

        // The file a translator hands back: the same file, with a blank filled in.
        exported[keys[0]] = 'Tornat de la revirada';
        await page.getByLabel(t('admin.languages.importJson')).setInputFiles({
          name: `trefaro-${LOCALE}.json`,
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(exported)),
        });

        await expect(page.getByRole('status')).toContainText(
          t('admin.languages.written', { count: 1 }),
        );
        await expect(page.getByRole('textbox', { name: keys[0] })).toHaveValue(
          'Tornat de la revirada',
        );
      } finally {
        await resetLocale(page);
      }
    });
  });

  test('refuses something that is not a language tag', async ({ page }) => {
    await page.goto('/languages');
    await page
      .getByLabel(t('admin.languages.addLanguage'))
      .fill('Occitan please');
    await page
      .getByRole('button', { name: t('admin.languages.add'), exact: true })
      .click();

    await expect(page.getByRole('alert')).toContainText(
      t('admin.languages.errorTag'),
    );
  });
});
