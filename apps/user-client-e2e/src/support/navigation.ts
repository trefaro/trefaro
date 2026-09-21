import { expect, type Locator, type Page } from '@playwright/test';
import { t } from './catalogue';

/**
 * Opens the navigation drawer and hands back its landmark (AP 7 of phase 5).
 *
 * Since the navigation became a drawer, every way to another page starts with
 * a click on the hamburger — the bar that used to stand on every screen is
 * gone. One helper rather than three lines in each suite, because the reason
 * is the same everywhere and a locator that opens something belongs next to
 * the locator that reads it.
 *
 * Returns the `navigation` landmark inside the dialog rather than the dialog
 * itself: what a test wants from here is an entry, and the entries are in the
 * landmark. Naming it keeps `getByRole('navigation')` unambiguous on a page
 * whose plug-ins draw navigations of their own.
 */
export async function openNavigation(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: t('app.nav.open') }).click();
  const navigation = page
    .getByRole('dialog', { name: t('app.nav.label') })
    .getByRole('navigation', { name: t('app.nav.label') });
  await expect(navigation).toBeVisible();
  return navigation;
}
