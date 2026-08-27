import { expect, test } from '@playwright/test';
import {
  DRAFT_EVENT,
  DRAFT_SERIES,
  PAST_EVENT,
  PUBLISHED_SERIES,
  UPCOMING_EVENT,
} from './support/series-fixtures';

/**
 * The public event landing page (FR 3.6, FR 3.9) and the series' event list
 * (FR 2.3), both without a login.
 *
 * These are the acceptance criteria of AP 3: a hybrid event shows its venue
 * *and* its online link, a draft event answers as absent, and the times appear
 * in the event's own zone rather than the browser's (E8).
 */
const landingPage = (seriesSlug: string, eventSlug: string) =>
  `/series/${seriesSlug}/events/${eventSlug}`;

test.describe('the event list of a series', () => {
  test('splits upcoming from past', async ({ page }) => {
    await page.goto(`/series/${PUBLISHED_SERIES.slug}`);

    const upcoming = page.getByRole('link', { name: UPCOMING_EVENT.name });
    const past = page.getByRole('link', { name: PAST_EVENT.name });
    await expect(upcoming).toBeVisible();
    await expect(past).toBeVisible();

    // Order on the page is what tells a participant which is which.
    const headings = await page
      .getByRole('heading', { level: 2 })
      .allInnerTexts();
    expect(headings).toEqual(['Upcoming events', 'Past events']);
  });

  test('does not list an event that is still a draft', async ({ page }) => {
    await page.goto(`/series/${PUBLISHED_SERIES.slug}`);

    await expect(page.getByText(DRAFT_EVENT.name)).toBeHidden();
  });

  test('opens the landing page of an event', async ({ page }) => {
    await page.goto(`/series/${PUBLISHED_SERIES.slug}`);
    await page.getByRole('link', { name: UPCOMING_EVENT.name }).click();

    await expect(page).toHaveURL(
      new RegExp(landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug) + '$'),
    );
  });
});

test.describe('the event landing page', () => {
  test('shows a hybrid event with both its venue and its link', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug));

    await expect(
      page.getByRole('heading', { name: UPCOMING_EVENT.name }),
    ).toBeVisible();
    await expect(page.getByText('On site and online')).toBeVisible();
    await expect(page.getByText(UPCOMING_EVENT.venueName)).toBeVisible();
    await expect(page.getByText(UPCOMING_EVENT.venueAddress)).toBeVisible();
    await expect(
      page.getByRole('link', { name: UPCOMING_EVENT.onlineUrl }),
    ).toBeVisible();
    // FR 3.1 lists the languages an event is held in.
    await expect(page.getByText('de, en')).toBeVisible();
  });

  test('states the time in the zone of the event, named as such', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug));

    // The fixture starts at 08:00 UTC in Europe/Berlin, so 09:00 or 10:00 local
    // depending on the season — the zone label is what makes it unambiguous, and
    // it must never be the browser's zone (the runner's is UTC).
    const when = page.getByText(/GMT\+[12]/);
    await expect(when).toBeVisible();
    await expect(when).toContainText(/\b(09|10):00\b/);
  });

  test('marks a past event as over and offers no registration', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, PAST_EVENT.slug));

    await expect(page.getByText('This event has ended')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register now' })).toBeHidden();
  });

  test('announces registration on an upcoming event', async ({ page }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug));

    // The form arrives in AP 4; the button must not pretend to work before then.
    const register = page.getByRole('button', { name: 'Register now' });
    await expect(register).toBeVisible();
    await expect(register).toBeDisabled();
  });

  test('says a draft event does not exist rather than showing it', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, DRAFT_EVENT.slug));

    await expect(page.getByRole('alert')).toContainText('does not exist');
  });

  test('hides every event of a series that is not public', async ({ page }) => {
    // Even a published event is unreachable while its series is a draft: the
    // series' visibility is not something an event can override.
    await page.goto(landingPage(DRAFT_SERIES.slug, UPCOMING_EVENT.slug));

    await expect(page.getByRole('alert')).toContainText('does not exist');
  });
});
