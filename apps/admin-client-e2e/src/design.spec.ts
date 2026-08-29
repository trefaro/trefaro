import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './support/admin-session';
import { t } from './support/catalogue';

/**
 * The legibility warning, with the threshold the page states.
 *
 * MIN_SURFACE_CONTRAST is 3, and it travels into the sentence as a parameter —
 * so this test names the key rather than a fragment of English (AP 9).
 */
const tooPale = t('admin.design.tooPale', { ratio: 3 });

/**
 * The design settings in the browser (FR 1.4, UC 1) — phase 2, AP 3.
 *
 * This is where the whitelabel chain is finished, and the acceptance criterion
 * is a browser one: an organizer changes the brand without touching the
 * database, the preview works *before* saving, and cancelling takes it back.
 * None of those three is a statement about a payload.
 *
 * The suite is split along a line the theming spec of the participant client
 * already draws — and here the reason is `app_config`, which is a **single row**
 * the whole instance reads while Playwright runs three browsers at once:
 *
 * - Everything that only happens in the client — the live preview, Discard, the
 *   legibility hint, a refused file — runs in **all three browsers** and writes
 *   nothing.
 * - The two tests that really write run in **chromium only**. Three workers
 *   saving and restoring one row would each assert the value another had just
 *   replaced, and the failure would read like a broken page. What the write does
 *   at the API level is covered in `apps/server-e2e/src/api/app-config.spec.ts`
 *   and `…/branding.spec.ts`; what only a browser can show is that the gesture
 *   reaches it.
 *
 * Both writing tests capture what they found and put it back, for the same
 * reason: the row belongs to the instance, not to this suite.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

interface Settings {
  organizationName: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
}

/** A real 1×1 PNG, so the browser can actually decode what was uploaded. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8/x8AAwMC' +
    'AO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

/** Reads a custom property off the document root, the way a plug-in would. */
const themeVariable = (name: string) =>
  `getComputedStyle(document.documentElement).getPropertyValue('${name}').trim()`;

async function openDesign(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: t('admin.design.title') }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: t('admin.design.title') }),
  ).toBeVisible();
  // The form is filled from `GET /api/admin/config`; an empty name means it has
  // not arrived yet, and every assertion below would race it.
  await expect(page.locator('#organization-name')).not.toHaveValue('');
}

async function storedSettings(page: Page): Promise<Settings> {
  const response = await page.request.get('/api/admin/config');
  expect(response.ok()).toBe(true);
  return (await response.json()) as Settings;
}

async function restore(page: Page, settings: Settings): Promise<void> {
  const response = await page.request.patch('/api/admin/config', {
    data: settings,
  });
  expect(`${response.status()} ${await response.text()}`).toMatch(/^200/);
}

test.describe('the design settings in the browser', () => {
  test('shows what the instance stores', async ({ page }) => {
    const stored = await storedSettings(page);
    await openDesign(page);

    await expect(page.locator('#organization-name')).toHaveValue(
      stored.organizationName,
    );
    // A colour input can only hold `#rrggbb`, so a stored shorthand is expanded
    // on the way in — the value is the same colour either way.
    await expect(page.locator('#primary-color')).toHaveValue(/^#[0-9a-f]{6}$/);
    await expect(page.locator('#font-family')).toHaveValue(stored.fontFamily);
  });

  test('previews a colour on the running client before anything is saved', async ({
    page,
  }) => {
    const stored = await storedSettings(page);
    await openDesign(page);

    await page.locator('#primary-color').fill('#123456');

    // The whole document, not a swatch: this is what E20 calls the preview, and
    // it is the same mechanism a plug-in web component reads.
    await expect
      .poll(() => page.evaluate(themeVariable('--trefaro-color-primary')))
      .toBe('#123456');
    // Derived, so the text on it follows without anybody storing a pair.
    expect(
      await page.evaluate(themeVariable('--trefaro-color-on-primary')),
    ).toBe('#ffffff');

    // And nothing was written: a reload shows the stored colour again.
    await page.reload();
    await expect
      .poll(() => page.evaluate(themeVariable('--trefaro-color-primary')))
      .toBe(stored.primaryColor);
  });

  test('takes the preview back when the change is discarded', async ({
    page,
  }) => {
    const stored = await storedSettings(page);
    await openDesign(page);

    await page.locator('#primary-color').fill('#123456');
    await expect
      .poll(() => page.evaluate(themeVariable('--trefaro-color-primary')))
      .toBe('#123456');

    await page.getByRole('button', { name: t('admin.design.discard') }).click();

    await expect
      .poll(() => page.evaluate(themeVariable('--trefaro-color-primary')))
      .toBe(stored.primaryColor);
    await expect(page.locator('#organization-name')).toHaveValue(
      stored.organizationName,
    );
  });

  test('takes the preview back when the organizer navigates away', async ({
    page,
  }) => {
    const stored = await storedSettings(page);
    await openDesign(page);
    await page.locator('#primary-color').fill('#123456');
    await expect
      .poll(() => page.evaluate(themeVariable('--trefaro-color-primary')))
      .toBe('#123456');

    // No reload: the same document, another route. An unsaved colour must not
    // follow an organizer into the rest of the workspace.
    await page.getByRole('link', { name: t('admin.modules.title') }).click();
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: t('admin.modules.title'),
        exact: true,
      }),
    ).toBeVisible();

    await expect
      .poll(() => page.evaluate(themeVariable('--trefaro-color-primary')))
      .toBe(stored.primaryColor);
  });

  test('warns when the primary colour disappears into the page (NFR 4)', async ({
    page,
  }) => {
    await openDesign(page);

    await page.locator('#primary-color').fill('#f4f4f4');

    await expect(page.getByText(tooPale)).toBeVisible();

    // And it goes away again — a hint that stays after the cause is gone is
    // worse than no hint.
    await page.locator('#primary-color').fill('#1f6f5c');
    await expect(page.getByText(tooPale)).toBeHidden();
  });

  test('refuses a file this instance would not serve, before it is sent', async ({
    page,
  }) => {
    await openDesign(page);

    await page.locator('#branding-file-logo').setInputFiles({
      name: 'logo.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    });

    // No SVG (E19's neighbour decision): it can carry script and would be served
    // from the origin of the client that displays it.
    await expect(page.getByRole('alert')).toContainText('image/svg+xml');
    // Nothing to upload, so there is no button offering to.
    await expect(
      page.getByRole('button', { name: t('admin.design.upload') }),
    ).toBeHidden();
  });

  test('saves the name and the font, and the menu follows at once', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'writes the singleton app_config row — three browsers in parallel would ' +
        'each assert what another just replaced',
    );
    const stored = await storedSettings(page);
    const name = 'E2E Design Organization';

    try {
      await openDesign(page);
      await page.locator('#organization-name').fill(name);
      await page.locator('#font-family').selectOption('lora');
      await page.getByRole('button', { name: t('admin.common.save') }).click();

      await expect(page.getByRole('status')).toContainText(
        t('admin.design.saved'),
      );
      // The client re-read its own configuration, so the menu shows the new
      // name without a reload. Every *other* client learns of it on its next
      // start (E20) — which is what the reload below stands in for.
      await expect(page.locator('.sidebar__title')).toHaveText(name);

      await page.reload();
      await expect(page.locator('.sidebar__title')).toHaveText(name);
      await expect
        .poll(() => page.evaluate(themeVariable('--trefaro-font-family')))
        .toMatch(/Lora/);
    } finally {
      await restore(page, stored);
    }
  });

  test('uploads a logo, shows it in the menu, and removes it again', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'writes the singleton app_config row — see the test above',
    );

    // Whatever this instance had, as bytes: the row is not this suite's.
    const before = await page.request.get('/api/config');
    const previousLogo = (
      (await before.json()) as {
        theme: { logoUrl: string | null };
      }
    ).theme.logoUrl;
    const previousBytes = previousLogo
      ? await (await page.request.get(previousLogo)).body()
      : null;

    try {
      await openDesign(page);
      await page.locator('#branding-file-logo').setInputFiles({
        name: 'brand.png',
        mimeType: 'image/png',
        buffer: PNG_1X1,
      });
      // Chosen, not sent: the preview is local until Upload is pressed.
      await expect(
        page.getByText(t('admin.design.notUploaded', { name: 'brand.png' })),
      ).toBeVisible();
      await page
        .getByRole('button', { name: t('admin.design.upload') })
        .click();

      // Served from the path-free public route (E19), and decodable — which a
      // request-level test cannot tell.
      const preview = page.getByRole('img', {
        name: t('admin.design.logoHeading'),
      });
      await expect(preview).toHaveAttribute(
        'src',
        /^\/api\/media\/branding\/logo\?v=\d+$/,
      );
      await expect
        .poll(() =>
          preview.evaluate((img: HTMLImageElement) => img.naturalWidth),
        )
        .toBeGreaterThan(0);

      // And the shell paints it, through the custom property rather than an
      // `<img>` — the same value a plug-in would read.
      await expect
        .poll(() => page.evaluate(themeVariable('--trefaro-logo-url')))
        .toContain('/api/media/branding/logo');
      await expect(page.locator('.sidebar__logo')).toBeAttached();

      await page
        .getByRole('button', { name: t('admin.design.remove') })
        .first()
        .click();

      await expect(
        page.getByText(t('admin.design.noImage')).first(),
      ).toBeVisible();
      await expect
        .poll(() => page.evaluate(themeVariable('--trefaro-logo-url')))
        .toBe('none');
      await expect(page.locator('.sidebar__logo')).toHaveCount(0);
    } finally {
      if (previousBytes) {
        const restored = await page.request.put('/api/admin/config/logo', {
          multipart: {
            file: {
              name: 'restored-logo',
              mimeType: 'image/png',
              buffer: previousBytes,
            },
          },
        });
        expect(restored.ok()).toBe(true);
      }
    }
  });
});
