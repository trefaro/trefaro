import { expect, test } from '@playwright/test';
import { t } from './support/catalogue';

/**
 * The first-run wizard, on an instance that has been set up (FR 1.1, E28).
 *
 * The wizard itself cannot be walked here, and that is by design rather than an
 * omission: it exists only while `admin_user` is empty, this instance was
 * created from `ADMIN_BOOTSTRAP_*`, and the last administrator cannot be deleted
 * (F22). So what a browser can prove is the closed door — that the address does
 * not offer a way to create an administrator on a running instance, and that
 * a visitor who lands there is sent to the login instead of to a dead form.
 *
 * The wizard's own behaviour lives in `setup-page.spec.ts`; the endpoints in
 * `apps/server-e2e/src/api/setup.spec.ts`; and the whole path, token and all, in
 * `tools/spike-verification/verify-setup.mjs` against a fresh stack.
 *
 * Without the shared session on purpose: this is about a browser that has none.
 */
test.describe('first-run setup', () => {
  test('sends a visitor away from the wizard, because there is nothing to set up', async ({
    page,
  }) => {
    await page.goto('/setup');

    // Via `/`, where the session guard decides — one place that decision is
    // made, not two.
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole('heading', { name: t('admin.login.title') }),
    ).toBeVisible();
    await expect(page.getByLabel(t('admin.setup.token'))).toBeHidden();
  });

  test('offers the login form rather than the wizard to somebody who is not signed in', async ({
    page,
  }) => {
    await page.goto('/');

    // The other direction of the same decision: while an administrator exists,
    // the login is the way in and the wizard must not be suggested anywhere.
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole('heading', { name: t('admin.setup.title') }),
    ).toBeHidden();
  });
});
