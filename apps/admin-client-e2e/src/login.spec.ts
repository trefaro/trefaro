import { expect, test } from '@playwright/test';
import { requireCredentials } from './support/admin-session';

/**
 * The administrative login in a real browser (UC 01, FR 1.3).
 *
 * Deliberately without the shared session: these tests are about what happens
 * to someone who has none. They log in at most twice per browser, because the
 * login is rate limited per address and the whole suite shares one.
 */
const credentials = requireCredentials();

async function signIn(
  page: import('@playwright/test').Page,
  password: string,
): Promise<void> {
  await page.getByLabel('E-mail address').fill(credentials.email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('administrative login', () => {
  test('sends a visitor to the login form instead of the workspace', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    // The workspace navigation must not be rendered at all.
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' }),
    ).toBeHidden();
  });

  test('says a password is wrong without saying whether the address exists', async ({
    page,
  }) => {
    await page.goto('/login');
    await signIn(page, 'definitely-not-the-password');

    await expect(page.getByRole('alert')).toHaveText(
      'Wrong e-mail address or password.',
    );
    await expect(page).toHaveURL(/\/login/);
  });

  test('signs in, continues where the organizer was heading, and signs out again', async ({
    page,
  }) => {
    // A deep link while logged out: the destination has to survive the login.
    await page.goto('/administrators');
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fadministrators$/);

    await signIn(page, credentials.password);

    await expect(
      page.getByRole('heading', { name: 'Administrators' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/administrators$/);
    // The account the server created is listed, with its address in the table —
    // the participant overview in AP 5 will hold to the same rule (FR 3.3).
    await expect(
      page.getByRole('cell', { name: credentials.email }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    // And the session is really gone, not just navigated away from.
    await page.goto('/administrators');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});
