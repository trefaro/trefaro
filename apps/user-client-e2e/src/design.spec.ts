import { expect, test, type Page } from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
import {
  closeSeedDatabase,
  deleteProfiles,
  seedProfile,
  seedSession,
} from './support/registration-seed';
import { signInWithSeededSession } from './support/participant-session';
import { PUBLISHED_SERIES, UPCOMING_EVENT } from './support/series-fixtures';

/**
 * The participant client on a phone (E67, E68) — AP 7 of phase 5.
 *
 * Its own Playwright project (`phone`, 390 × 844) and its own small selection:
 * every test here carries the `@design` tag, the three desktop projects skip
 * exactly those, and the phone project runs nothing else. That is E68 in the
 * configuration — and the other half of it is what this file does **not** do:
 * it registers nobody, confirms nothing and signs in through no form. It reads
 * pages, and the one session it needs is seeded (F164), so the whole file costs
 * zero of the budgets three e2e projects share (E4).
 *
 * What it guards is the shape of a page rather than its words: nothing sticks
 * out sideways, no two controls sit on top of each other, everything a thumb
 * has to hit is at least 44 CSS pixels high, and nothing is written in the
 * colour it stands on. The first three are what a desktop project cannot see —
 * at 1280 pixels a layout that breaks at 390 looks perfectly well — and the
 * fourth is here because this package wrote white words on a white drawer and
 * only a screenshot found it.
 *
 * Plug-in elements are excluded on purpose: a bundle brings its own CSS and is
 * its own package's business (F21 in miniature), and this file must not turn
 * red because somebody else's suite switched a plug-in on while it ran.
 */

/** What a thumb needs, in CSS pixels (WCAG 2.2 SC 2.5.5, "Target Size"). */
const TARGET = 44;

const eventPath = `/series/${PUBLISHED_SERIES.slug}/events/${UPCOMING_EVENT.slug}`;

const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4200';

/** This file's own domain, so its teardown cannot take another suite's rows. */
const ADDRESS_DOMAIN = '@design-e2e.example.org';

interface Layout {
  readonly scrollWidth: number;
  readonly innerWidth: number;
  readonly small: readonly string[];
  readonly overlaps: readonly string[];
  readonly unreadable: readonly string[];
}

/**
 * The contrast a boundary or a piece of text needs to be *there* at all.
 *
 * Three, not four and a half: what this file guards is that nothing is written
 * in the colour it stands on — which is the failure AP 7 of phase 5 produced
 * twice in one afternoon, once at a ratio of 1:1 (white drawer, white words)
 * and once with no border at all. Whether a muted grey reaches the 4.5:1 that
 * SC 1.4.3 asks of body text is a question about the theme, and the theme
 * answers it in its own unit tests.
 */
const MIN_CONTRAST = 3;

/**
 * Measures one rendered page.
 *
 * In the browser rather than over screenshots: a picture would need a stored
 * reference, and the four questions here have answers that are numbers.
 */
async function layoutOf(page: Page, target: number): Promise<Layout> {
  return page.evaluate(
    ([minimum, minContrast]) => {
      const name = (element: Element): string => {
        const tag = element.tagName.toLowerCase();
        const type = element.getAttribute('type');
        const text = (element.textContent ?? '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 30);
        const label =
          text ||
          element.getAttribute('aria-label') ||
          element.getAttribute('name') ||
          '';
        return `${tag}${type ? `[${type}]` : ''}${label ? ` "${label}"` : ''}`;
      };

      const shown = (element: Element): boolean => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      };

      /** Everything a finger can hit, minus what a plug-in bundle drew. */
      const controls = [
        ...document.querySelectorAll(
          'a, button, input, select, textarea, [role="button"]',
        ),
      ].filter(
        (element) => shown(element) && !element.closest('.trefaro-plugin-slot'),
      );

      /** A link inside a sentence is text, and text is not a target. */
      const standalone = (element: Element): boolean =>
        element.tagName !== 'A' ||
        getComputedStyle(element).display !== 'inline';

      /** A tick box is hit through its label, so that is what gets measured. */
      const hitArea = (element: Element): Element =>
        element instanceof HTMLInputElement &&
        (element.type === 'checkbox' || element.type === 'radio')
          ? (element.closest('label') ?? element)
          : element;

      const small = controls
        .filter(standalone)
        .map(hitArea)
        .filter((element) => element.getBoundingClientRect().height < minimum)
        .map(
          (element) =>
            `${Math.round(element.getBoundingClientRect().height)}px ${name(element)}`,
        );

      const overlaps: string[] = [];
      for (let i = 0; i < controls.length; i++) {
        for (let j = i + 1; j < controls.length; j++) {
          const one = controls[i];
          const other = controls[j];
          if (one.contains(other) || other.contains(one)) continue;
          const a = one.getBoundingClientRect();
          const b = other.getBoundingClientRect();
          // A pixel of tolerance: a shared border is not an overlap.
          if (
            a.left < b.right - 1 &&
            b.left < a.right - 1 &&
            a.top < b.bottom - 1 &&
            b.top < a.bottom - 1
          ) {
            overlaps.push(`${name(one)} over ${name(other)}`);
          }
        }
      }

      /* --- is anything written in the colour it stands on? ----------------- */

      /**
       * A computed colour as four numbers, or `null` for a notation this does
       * not read.
       *
       * Two notations arrive, and the second is the one that made the first
       * run of this check call seven pieces of perfectly legible text
       * invisible: the theme's shades are `color-mix(in oklab, …)`, and the
       * computed value comes back as `color(srgb 0.07 0.2 0.16)` — where the
       * components run from **zero to one**, not from zero to 255. Read as
       * `rgb()` they all come out near black, and every themed surface looks
       * like text on its own colour. Anything else is skipped rather than
       * guessed; a wrong guess here is a red test about nothing.
       */
      const channels = (
        colour: string,
      ): [number, number, number, number] | null => {
        const value = colour.trim();
        const scale = value.startsWith('color(') ? 255 : 1;
        if (scale === 1 && !value.startsWith('rgb')) return null;
        const numbers =
          value
            .match(/-?[\d.]+%?/g)
            ?.map((part) =>
              part.endsWith('%')
                ? Number(part.slice(0, -1)) / 100
                : Number(part),
            ) ?? [];
        if (numbers.length < 3) return null;
        return [
          numbers[0] * scale,
          numbers[1] * scale,
          numbers[2] * scale,
          numbers[3] ?? 1,
        ];
      };

      const over = (
        top: [number, number, number, number],
        bottom: [number, number, number, number],
      ): [number, number, number, number] => [
        top[0] * top[3] + bottom[0] * (1 - top[3]),
        top[1] * top[3] + bottom[1] * (1 - top[3]),
        top[2] * top[3] + bottom[2] * (1 - top[3]),
        1,
      ];

      /** The colour actually behind an element, walking up through what is transparent. */
      const behind = (element: Element): [number, number, number, number] => {
        const stack: [number, number, number, number][] = [];
        for (
          let node: Element | null = element;
          node;
          node = node.parentElement
        ) {
          const colour = channels(getComputedStyle(node).backgroundColor);
          if (!colour) continue;
          if (colour[3] > 0) stack.push(colour);
          if (colour[3] === 1) break;
        }
        return stack
          .reverse()
          .reduce((below, layer) => over(layer, below), [255, 255, 255, 1]);
      };

      const luminance = ([r, g, b]: [
        number,
        number,
        number,
        number,
      ]): number => {
        const linear = (value: number): number => {
          const channel = value / 255;
          return channel <= 0.04045
            ? channel / 12.92
            : Math.pow((channel + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
      };

      const ratio = (
        a: [number, number, number, number],
        b: [number, number, number, number],
      ): number => {
        const one = luminance(a);
        const other = luminance(b);
        return (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05);
      };

      const writes = (element: Element): boolean =>
        [...element.childNodes].some(
          (node) =>
            node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        );

      const unreadable = [...document.querySelectorAll('body *')]
        .filter(
          (element) =>
            writes(element) &&
            shown(element) &&
            !element.closest('.trefaro-plugin-slot'),
        )
        .map((element) => {
          const background = behind(element);
          const written = channels(getComputedStyle(element).color);
          if (!written) return null;
          const ink = over(written, background);
          const contrast = ratio(ink, background);
          return contrast < minContrast
            ? `${name(element)} is written in the colour it stands on ` +
                `(${Math.round(contrast * 100) / 100}:1)`
            : null;
        })
        .filter((finding): finding is string => finding !== null);

      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        small: [...new Set(small)],
        overlaps: [...new Set(overlaps)],
        unreadable: [...new Set(unreadable)],
      };
    },
    [target, MIN_CONTRAST] as const,
  );
}

test.describe('the participant client on a phone', () => {
  let profileId = '';
  let token = '';

  test.beforeAll(async () => {
    profileId = await seedProfile({
      email: `phone${process.pid}${ADDRESS_DOMAIN}`,
      firstName: 'Pia',
      lastName: 'Phone',
    });
    token = await seedSession(profileId);
  });

  test.afterAll(async () => {
    await deleteProfiles(ADDRESS_DOMAIN);
    await closeSeedDatabase();
  });

  test(
    'reads six pages without sideways scrolling, overlaps or small targets',
    { tag: '@design' },
    async ({ page, context }) => {
      await signInWithSeededSession(context, CLIENT_URL, token);

      const findings: string[] = [];
      for (const path of [
        '/',
        `/series/${PUBLISHED_SERIES.slug}`,
        eventPath,
        `${eventPath}/register`,
        '/registrations',
        '/profile',
      ]) {
        await page.goto(path);
        // Something visible first: an empty page is narrow, has no overlaps
        // and no targets at all, so all three assertions would pass on it.
        await expect(page.getByRole('heading').first()).toBeVisible();

        const layout = await layoutOf(page, TARGET);
        const say = (what: string): string => `${path}: ${what}`;
        findings.push(
          ...[
            say(
              `${layout.scrollWidth}px of page in a ${layout.innerWidth}px window`,
            ),
          ].filter(() => layout.scrollWidth > layout.innerWidth),
          ...layout.overlaps.map(say),
          ...layout.small.map((small) => say(`${small} is under ${TARGET}px`)),
          ...layout.unreadable.map(say),
        );
        await expectNoRawKeys(page);
      }

      expect(findings).toEqual([]);
    },
  );

  test(
    'opens the navigation as a drawer and closes it again',
    { tag: '@design' },
    async ({ page, context }) => {
      await signInWithSeededSession(context, CLIENT_URL, token);
      await page.goto('/');
      await expect(page.getByRole('heading').first()).toBeVisible();

      const drawer = page.getByRole('dialog', { name: t('app.nav.label') });
      const open = page.getByRole('button', { name: t('app.nav.open') });

      // Closed, and the whole navigation with it: on a phone the page is the
      // page, not a page beside a list of other pages.
      await expect(drawer).toBeHidden();
      await expect(open).toBeVisible();

      await open.click();
      await expect(drawer).toBeVisible();
      // Who this is, at the top, as both mockups show it.
      await expect(drawer.getByText('Pia Phone')).toBeVisible();
      await expect(
        drawer.getByText(`phone${process.pid}${ADDRESS_DOMAIN}`),
      ).toBeVisible();
      // And the way out, pinned at the bottom.
      await expect(
        drawer.getByRole('button', { name: t('app.nav.signOut') }),
      ).toBeVisible();

      // It leaves a strip of the page beside it, so it reads as a layer over
      // the page rather than as a new page.
      const box = await drawer.boundingBox();
      expect(box?.width ?? 0).toBeLessThan(390);

      const layout = await layoutOf(page, TARGET);
      expect(layout.small).toEqual([]);
      // The drawer is drawn inside a header painted in the brand colour, so
      // this is the assertion that would have caught it white on white.
      expect(layout.unreadable).toEqual([]);
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth);

      // Escape closes it, and the way back in has the focus again.
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
      await expect(open).toBeFocused();

      // A row leads somewhere and takes the drawer with it.
      await open.click();
      await drawer.getByRole('link', { name: t('profile.title') }).click();
      await expect(page).toHaveURL(/\/profile$/);
      await expect(drawer).toBeHidden();
      await expectNoRawKeys(page);
    },
  );
});
