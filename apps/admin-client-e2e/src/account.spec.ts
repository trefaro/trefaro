import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './support/admin-session';
import { t } from './support/catalogue';

/**
 * The organizer's own account page (AP 9 of phase 5).
 *
 * What this suite asserts is the way there and the shape of the form, and what
 * it deliberately does **not** do is change a password. It cannot: every spec
 * in this suite shares one seeded session of one account (F164), so a test
 * that changed that account's password would end every other session of it
 * and take the rest of the run with it — the same reason
 * `apps/server-e2e/src/api/admin-password.spec.ts` works on a throwaway
 * account it creates and deletes itself. The change is proved there, on the
 * wire, and by the page's own unit test.
 *
 * Writes nothing, signs nobody in, costs no budget (E4).
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe('the organizer’s own account', () => {
  test('is reached from the name in the menu, not from the list of colleagues', async ({
    page,
  }) => {
    await page.goto('/administrators');

    // By address rather than by label: the link's accessible name is whoever
    // is signed in, which a suite cannot know — and the route is part of the
    // contract in a way a class name is not.
    await page.locator('a[href="/account"]').click();

    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByRole('heading', { name: t('admin.account.title') }),
    ).toBeVisible();
  });

  test('asks for the current password beside the new one, and says there is no reset', async ({
    page,
  }) => {
    await page.goto('/account');

    await expect(
      page.getByLabel(t('admin.account.current'), { exact: true }),
    ).toHaveAttribute('type', 'password');
    await expect(
      page.getByLabel(t('admin.account.new'), { exact: true }),
    ).toHaveAttribute('type', 'password');

    // The absence of a reset link is a decision, so the page states it
    // (`account-page.ts`) rather than leaving somebody locked out to find out.
    await expect(page.getByText(t('admin.account.noReset'))).toBeVisible();
  });

  test('refuses to send a new password the policy would reject', async ({
    page,
  }) => {
    await page.goto('/account');

    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('admin/me/password')) {
        requests.push(request.method());
      }
    });

    await page
      .getByLabel(t('admin.account.current'), { exact: true })
      .fill('whatever-it-is-now');
    await page
      .getByLabel(t('admin.account.new'), { exact: true })
      .fill('short');
    await page.getByRole('button', { name: t('admin.account.submit') }).click();

    // Nothing leaves the browser: the form knows the policy, so a too-short
    // passphrase costs no round trip and no rate-limit counter.
    expect(requests).toEqual([]);
  });
});
