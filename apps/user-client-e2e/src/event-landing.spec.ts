import { expect, test } from '@playwright/test';
import {
  DRAFT_EVENT,
  DRAFT_SERIES,
  PAST_EVENT,
  PROGRAM_ITEMS,
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
 *
 * The programme block at the end is the second half of AP 8's criterion: the
 * timeline renders in the event's zone. It belongs in a browser rather than in
 * the API contract suite because the conversion happens in the client — the
 * server sends absolute instants, and the runner's own zone is UTC, so a page
 * that read the reader's clock would be visibly an hour or two out here.
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
    //
    // Scoped to the event's own facts, whose first entry is "When": since AP 8
    // the programme's day headings name the zone as well, and a page-wide match
    // for it is no longer unique.
    const when = page.getByRole('definition').first();
    await expect(when).toContainText(/GMT\+[12]/);
    await expect(when).toContainText(/\b(09|10):00\b/);
  });

  test('marks a past event as over and offers no registration', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, PAST_EVENT.slug));

    await expect(page.getByText('This event has ended')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register now' })).toBeHidden();
  });

  test('leads to the registration form on an upcoming event', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug));

    await page.getByRole('link', { name: 'Register now' }).click();

    // The form itself is covered by `registration.spec.ts`; what matters here is
    // that the landing page's call to action reaches it.
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
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

test.describe('the programme on the landing page', () => {
  test('lists the sessions with the clock of the venue, not the reader', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug));

    const program = page.getByRole('region', { name: 'Programme' });
    await expect(program).toBeVisible();
    await expect(
      program.getByRole('heading', { name: PROGRAM_ITEMS[0].title }),
    ).toBeVisible();

    // The fixture starts at 08:00 UTC in Europe/Berlin, so 09:00 or 10:00 at the
    // venue depending on the season. The runner's zone is UTC: a timeline that
    // rendered the reader's clock would show 08:00 here (E8).
    await expect(
      program.getByText(/\b(09|10):00–(10|11):00\b/).first(),
    ).toBeVisible();
    await expect(program.getByText(/\b08:00\b/)).toBeHidden();
  });

  test('names the day and its zone once per day', async ({ page }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug));

    const program = page.getByRole('region', { name: 'Programme' });
    // Two of the three fixture sessions are on the event's first day and one on
    // its last, so the timeline has exactly two day headings — and each names
    // the zone, so nobody has to guess whose 09:00 this is.
    const days = program.getByRole('heading', { level: 3 });
    await expect(days).toHaveCount(2);
    await expect(days.first()).toContainText(/GMT\+[12]/);
  });

  test('shows the speaker and the abstract where there is one', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug));

    const program = page.getByRole('region', { name: 'Programme' });
    await expect(program.getByText('Dr. Amara Nwosu')).toBeVisible();
    await expect(
      program.getByText(PROGRAM_ITEMS[0].description as string),
    ).toBeVisible();
    // The session without either shows neither, rather than an empty line.
    await expect(
      program.getByRole('heading', { name: PROGRAM_ITEMS[1].title }),
    ).toBeVisible();
  });

  test('is absent altogether for an event with no programme', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, PAST_EVENT.slug));

    // No empty heading over nothing: a past event with no sessions planned says
    // nothing about a programme at all.
    await expect(page.getByRole('heading', { name: 'Programme' })).toBeHidden();
  });
});
