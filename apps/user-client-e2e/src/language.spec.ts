import { expect, test } from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
import { PUBLISHED_SERIES, UPCOMING_EVENT } from './support/series-fixtures';

/**
 * The language switch in the participant client (chapter 4, NFR 4) — phase 2,
 * AP 6.
 *
 * What only a browser can show, and what a unit test structurally cannot:
 *
 * - that the catalogue really travels over HTTP before the first paint, rather
 *   than being bundled into this client (E22);
 * - that a switch repaints a **zoneless** application. That is the risk the
 *   phase plan asked to settle before any text was moved, and it is settled in
 *   two places: `zoneless-language-change.spec.ts` pins the three ways of
 *   reading a translation, and this asserts it on the running client;
 * - that `<html lang>` follows, which is what a screen reader reads its
 *   pronunciation from;
 * - that the choice survives a reload, because it lives in `localStorage`.
 *
 * Writes nothing on the server, so it runs in all three browsers: a language
 * preference is per browser context, and Playwright gives each test its own.
 *
 * Since AP 8 it also carries the acceptance criterion of that package: the
 * landing page in German is *fully* German — including the labels that are
 * assembled in TypeScript, which have no pipe to redraw them and are the ones an
 * extraction quietly leaves behind (F72).
 */
test.describe('participant client language', () => {
  test('starts in the language the instance offers and the browser asks for', async ({
    page,
  }) => {
    await page.goto('/');

    const switcher = page.getByRole('combobox');
    await expect(switcher).toBeVisible();
    // Two options because the image ships two catalogues and a fresh instance
    // offers what it ships — a complete translation hidden behind a default
    // would be a defect rather than a configuration.
    await expect(switcher.locator('option')).toHaveCount(2);
  });

  test('switches the interface, the document language and back', async ({
    page,
  }) => {
    await page.goto('/');
    const switcher = page.getByRole('combobox');

    // The switcher's own label is a catalogue key, so it is the smallest piece
    // of visible text that proves the catalogue arrived and is in use.
    await expect(page.getByText('Language', { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await switcher.selectOption('de');

    await expect(page.getByText('Sprache', { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    await switcher.selectOption('en');

    await expect(page.getByText('Language', { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('remembers the choice across a reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox').selectOption('de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    await page.reload();

    // In `localStorage`, not in a cookie: nothing on the server reads it, and a
    // participant who switched once should not switch again tomorrow.
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByText('Sprache', { exact: true })).toBeVisible();
  });

  test('follows a browser that asks for German', async ({ browser }) => {
    // A visitor who has never chosen gets what their browser asks for, matched
    // on the primary subtag — `de-AT` is served this instance's `de`.
    const context = await browser.newContext({ locale: 'de-AT' });
    const page = await context.newPage();
    try {
      await page.goto('/');

      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    } finally {
      await context.close();
    }
  });

  test('fetches the catalogue from the server rather than from its bundle', async ({
    page,
  }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/i18n/')) requested.push(request.url());
    });

    await page.goto('/');
    await page.getByRole('combobox').selectOption('de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    // The whole of E22 in one assertion: the text of this client is data the
    // instance serves, so an organization can change a word without a rebuild.
    expect(requested.some((url) => url.endsWith('/api/i18n/en'))).toBe(true);
    expect(requested.some((url) => url.endsWith('/api/i18n/de'))).toBe(true);
  });

  test('translates a whole event landing page, code-built labels included', async ({
    page,
  }) => {
    const address = `/series/${PUBLISHED_SERIES.slug}/events/${UPCOMING_EVENT.slug}`;
    await page.goto(address);
    await page.getByRole('combobox').selectOption('de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    // From the template, through the pipe.
    await expect(
      page.getByRole('heading', { name: t('event.program', {}, 'de') }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: t('event.register', {}, 'de') }),
    ).toBeVisible();

    // Assembled in TypeScript from three keys — the hybrid event's format, and
    // the tile hint that counts the sessions. Neither has a pipe of its own, so
    // both would still be English if the language were not read where they are
    // built.
    await expect(
      page.getByText(t('event.onSiteAndOnline', {}, 'de')),
    ).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: t('event.tiles.label', {}, 'de') })
        .getByRole('link', { name: t('event.program', {}, 'de') }),
    ).toBeVisible();

    // And the date, which is not a translation but a format: German writes
    // "17. September", English "September 17". The zone stays the venue's (E8)
    // but is *named* in the reader's language — German calls Berlin's winter
    // "MEZ" where English says "GMT+1", which is the same instant and the same
    // zone under the name its reader knows.
    const when = page.getByRole('definition').first();
    await expect(when).toContainText(/\d{1,2}\.\s/);
    await expect(when).toContainText(/MEZ|MESZ/);

    await expectNoRawKeys(page);
  });
});
