import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STORAGE_STATE, fixtureLabel } from './support/admin-session';
import { t } from './support/catalogue';
import {
  closeFixtureDatabase,
  removeParticipants,
  seedParticipants,
  type SeededEvent,
} from './support/registration-fixtures';

/**
 * The organizer client at tablet width (E67) — AP 8 of phase 5.
 *
 * Its own Playwright project (`tablet`, 768 × 1024) and its own small
 * selection, exactly as the participant client's `@design` file works (E68):
 * every test here carries the `@layout` tag, the three desktop projects skip
 * those, and the tablet project runs nothing else. It costs no budget — it
 * signs nobody in (the session is the one the global setup already made),
 * registers nobody and sends no mail. It reads pages, and writes its rows
 * straight into the database like every other fixture in this suite.
 *
 * 768 is a floor and not a design (NFR 6 keeps this client desktop-first, and
 * the thesis drew no mockups for it), so what is guarded here is what is
 * *unusable* rather than what is pretty:
 *
 * - no page pushes itself sideways — the width of the window is the width of
 *   the document;
 * - a table that does not fit scrolls **inside its own frame**, and that frame
 *   is a named region a keyboard can reach;
 * - the participant overview keeps its address column, which is the one
 *   correction the thesis' usability test asked for;
 * - the menu is a drawer that opens over the page and closes again, instead of
 *   190 pixels of navigation stacked above every page.
 *
 * What it deliberately does not do is compare pictures: a stored screenshot
 * would have to be regenerated for every wording, and the four questions above
 * have answers that are numbers.
 */

/** The floor WCAG 2.2 SC 2.5.8 sets for a pointer target, in CSS pixels. */
const TARGET = 24;

interface Layout {
  readonly scrollWidth: number;
  readonly innerWidth: number;
  /** The innermost elements that cross the right edge of the window. */
  readonly crossing: readonly string[];
  /** Controls below the target floor, as `<height>px <what>`. */
  readonly small: readonly string[];
}

/** Measures one rendered page, in the browser: the answers are numbers. */
async function layoutOf(page: Page): Promise<Layout> {
  return page.evaluate((minimum) => {
    const name = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      const type = element.getAttribute('type');
      const text = (element.textContent ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 30);
      const label = text || element.getAttribute('aria-label') || '';
      return `${tag}${type ? `[${type}]` : ''}${label ? ` "${label}"` : ''}`;
    };

    const shown = (element: Element): boolean => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    };

    const edge = window.innerWidth;
    const outside = [...document.querySelectorAll('body *')].filter(
      (element) =>
        shown(element) && element.getBoundingClientRect().right > edge + 1,
    );

    const crossing = outside
      .filter(
        (element) =>
          !outside.some(
            (other) => other !== element && element.contains(other),
          ),
      )
      .map(
        (element) =>
          `${name(element)} → ${Math.round(element.getBoundingClientRect().right)}`,
      );

    /** A link inside a sentence is text, and text is not a target. */
    const standalone = (element: Element): boolean =>
      element.tagName !== 'A' || getComputedStyle(element).display !== 'inline';

    const small = [
      ...document.querySelectorAll(
        'button, input:not([type="hidden"]), select, textarea',
      ),
    ]
      .filter(
        (element) => shown(element) && !element.closest('.trefaro-plugin-slot'),
      )
      .filter(standalone)
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.height < minimum || box.width < minimum;
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        return `${Math.round(box.width)}×${Math.round(box.height)} ${name(element)}`;
      });

    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: edge,
      crossing,
      small,
    };
  }, TARGET);
}

test.use({ storageState: ADMIN_STORAGE_STATE });

let seeded: SeededEvent;

test.beforeAll(async () => {
  seeded = await seedParticipants(fixtureLabel('layout'));
});

test.afterAll(async () => {
  await removeParticipants(seeded);
  await closeFixtureDatabase();
});

test(
  'reads six pages at tablet width without the page scrolling sideways',
  { tag: '@layout' },
  async ({ page }) => {
    // One of each kind this client has: a list, a form, a dashboard, the
    // widest table, the settings page with its images, and the one page that
    // is a table of text fields.
    const pages: ReadonlyArray<readonly [string, string]> = [
      ['series list', '/'],
      ['event form', `/series/${seeded.seriesId}/events/new`],
      [
        'event dashboard',
        `/series/${seeded.seriesId}/events/${seeded.eventId}`,
      ],
      [
        'participants',
        `/series/${seeded.seriesId}/events/${seeded.eventId}/participants`,
      ],
      ['design', '/design'],
      ['languages', '/languages'],
    ];

    const findings: string[] = [];
    for (const [what, path] of pages) {
      await page.goto(path);
      await page.locator('h1').first().waitFor({ state: 'visible' });
      const layout = await layoutOf(page);

      if (layout.scrollWidth > layout.innerWidth + 1) {
        findings.push(
          `${what}: ${layout.scrollWidth} wide in ${layout.innerWidth} — ` +
            layout.crossing.join('; '),
        );
      }
      for (const control of layout.small) {
        findings.push(`${what}: ${control}`);
      }
    }

    expect(findings, findings.join('\n')).toEqual([]);
  },
);

test(
  'scrolls the widest table inside its own frame, address column and all',
  { tag: '@layout' },
  async ({ page }) => {
    await page.goto(
      `/series/${seeded.seriesId}/events/${seeded.eventId}/participants`,
    );
    await page
      .getByRole('heading', { name: t('admin.participants.title') })
      .first()
      .waitFor();

    // The one correction the thesis' usability test asked for: the address is
    // in the table, and it is still there at 768 pixels.
    await expect(
      page.getByRole('columnheader', {
        name: t('admin.participants.colEmail'),
      }),
    ).toBeVisible();

    const frame = page.getByRole('region', {
      name: t('admin.participants.title'),
    });
    await expect(frame).toBeVisible();

    const measured = await frame.evaluate((element) => ({
      scrolls: element.scrollWidth > element.clientWidth + 1,
      tabindex: element.getAttribute('tabindex'),
      documentWidth: document.documentElement.scrollWidth,
      windowWidth: window.innerWidth,
    }));

    // The table moves, the page does not — and the frame that moves is
    // reachable from a keyboard (SC 2.1.1).
    expect(measured.scrolls).toBe(true);
    expect(measured.tabindex).toBe('0');
    expect(measured.documentWidth).toBeLessThanOrEqual(
      measured.windowWidth + 1,
    );
  },
);

test(
  'opens the menu over the page and closes it again',
  { tag: '@layout' },
  async ({ page }) => {
    await page.goto('/');
    const main = page.locator('main');
    await main.waitFor();

    const toggle = page.getByRole('button', { name: t('admin.nav.open') });
    const menu = page.getByRole('navigation', { name: t('admin.nav.label') });

    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Closed means gone, not merely off-screen: nothing in it is a tab stop.
    await expect(menu).toBeHidden();

    const before = await main.boundingBox();
    await toggle.click();

    await expect(menu).toBeVisible();
    await expect(
      page.getByRole('button', { name: t('admin.nav.close') }),
    ).toHaveAttribute('aria-expanded', 'true');
    // A drawer lies over the page; it does not push it.
    //
    // Where the content box *starts* and how wide it is, and deliberately not
    // how tall: the series list keeps loading while this runs, so its height
    // changes between the two readings for a reason that has nothing to do
    // with the drawer — which is what made this flake in AP 9 of phase 5, on a
    // database that happened to hold a few hundred leftover rows. Pushing
    // would show up in `y` (stacked above) or in `x` and `width` (pushed
    // aside); both are read.
    const after = await main.boundingBox();
    expect({ x: after?.x, y: after?.y, width: after?.width }).toEqual({
      x: before?.x,
      y: before?.y,
      width: before?.width,
    });

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(toggle).toBeFocused();

    // And arriving somewhere puts the page back in view by itself.
    await toggle.click();
    await menu.getByRole('link', { name: t('admin.modules.title') }).click();
    await expect(
      page.getByRole('heading', { name: t('admin.modules.title') }).first(),
    ).toBeVisible();
    await expect(menu).toBeHidden();
  },
);
