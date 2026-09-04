import { expect, test, type Page } from '@playwright/test';
import { expectNoRawKeys, t } from './support/catalogue';
import {
  DRAFT_EVENT,
  DRAFT_SERIES,
  MEDIA_LINKS,
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
 * The programme block is the second half of AP 8's criterion: the timeline
 * renders in the event's zone. It belongs in a browser rather than in the API
 * contract suite because the conversion happens in the client — the server sends
 * absolute instants, and the runner's own zone is UTC, so a page that read the
 * reader's clock would be visibly an hour or two out here.
 *
 * The last two blocks are AP 11's criterion, from the participant's side: the
 * follow-up section appears only after the event has ended, and media links are
 * links that leave the page rather than embedded players (F50, F51).
 *
 * The tiles at the end are AP 4 of phase 2 (mockups 5.2): what this event offers,
 * as jump links into the page itself. A browser is the only place that can show
 * they lead anywhere — a payload has no viewport.
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

    // Order on the page is what tells a participant which is which — asserted
    // over the headings of the series itself (`article > h2`) rather than over
    // every second-level heading the page has. It grew one in AP 12: the
    // newsletter sign-up, which brings its own `<section>` when its module is
    // on, and an exact list of everything would break for a reason that has
    // nothing to do with upcoming and past.
    const headings = await page.locator('article > h2').allInnerTexts();
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
    await expect(page.getByText(t('event.onSiteAndOnline'))).toBeVisible();
    await expect(page.getByText(UPCOMING_EVENT.venueName)).toBeVisible();
    await expect(page.getByText(UPCOMING_EVENT.venueAddress)).toBeVisible();
    await expect(
      page.getByRole('link', { name: UPCOMING_EVENT.onlineUrl }),
    ).toBeVisible();
    // FR 3.1 lists the languages an event is held in.
    await expect(page.getByText('de, en')).toBeVisible();
    await expectNoRawKeys(page);
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

    await expect(page.getByText(t('event.hasEnded'))).toBeVisible();
    await expect(
      page.getByRole('link', { name: t('event.register') }),
    ).toBeHidden();
  });

  test('leads to the registration form on an upcoming event', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug));

    await page.getByRole('link', { name: t('event.register') }).click();

    // The form itself is covered by `registration.spec.ts`; what matters here is
    // that the landing page's call to action reaches it.
    await expect(page).toHaveURL(/\/register$/);
    await expect(
      page.getByRole('heading', { name: t('register.title') }),
    ).toBeVisible();
  });

  test('says a draft event does not exist rather than showing it', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, DRAFT_EVENT.slug));

    await expect(page.getByRole('alert')).toHaveText(t('event.errorMissing'));
  });

  test('hides every event of a series that is not public', async ({ page }) => {
    // Even a published event is unreachable while its series is a draft: the
    // series' visibility is not something an event can override.
    await page.goto(landingPage(DRAFT_SERIES.slug, UPCOMING_EVENT.slug));

    await expect(page.getByRole('alert')).toHaveText(t('event.errorMissing'));
  });
});

test.describe('the programme on the landing page', () => {
  test('lists the sessions with the clock of the venue, not the reader', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug));

    const program = page.getByRole('region', { name: t('event.program') });
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

    const program = page.getByRole('region', { name: t('event.program') });
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

    const program = page.getByRole('region', { name: t('event.program') });
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
    await expect(
      page.getByRole('heading', { name: t('event.program') }),
    ).toBeHidden();
  });
});

test.describe('what an event leaves behind', () => {
  const stream = MEDIA_LINKS[0];
  const sessionMaterial = MEDIA_LINKS[1];
  const recording = MEDIA_LINKS[2];

  test('shows the follow-up text of an event that is over', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, PAST_EVENT.slug));

    const followUp = page.getByRole('region', { name: t('event.followUp') });
    await expect(followUp).toBeVisible();
    await expect(followUp).toContainText('E2E thank you for coming');
  });

  test('does not show the follow-up text of an event still to come', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug));

    // The fixture has written one, so this is not "there is nothing to show":
    // the server withholds it until the event has ended (F50), which means the
    // sentence is not in the page source either.
    await expect(
      page.getByRole('heading', { name: t('event.followUp') }),
    ).toBeHidden();
    expect(await page.content()).not.toContain(
      'must not be readable before the event',
    );
  });

  test('links to a stream rather than embedding it', async ({ page }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug));

    const media = page.getByRole('region', { name: t('event.media') });
    await expect(media).toBeVisible();
    // The section names the kind, so a participant knows what they are opening.
    await expect(media.getByRole('heading', { level: 3 })).toContainText(
      t('mediaLinks.kind.stream.many'),
    );

    const link = media.getByRole('link', { name: stream.title });
    await expect(link).toHaveAttribute('href', stream.url);
    await expect(link).toHaveAttribute('target', '_blank');
    // No referrer: following the link does not tell the other side which
    // instance sent the visitor (NFR 9, F51).
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // And nothing is embedded — an iframe would load a third party's code into
    // a page that promises not to.
    await expect(page.locator('iframe')).toHaveCount(0);
  });

  test("puts a session's link with its session, not in the list", async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug));

    // The slides of the keynote hang on the keynote, so they are inside the
    // timeline rather than in the event's own media section.
    const session = page
      .getByRole('listitem')
      .filter({ hasText: PROGRAM_ITEMS[0].title });
    await expect(
      session.getByRole('link', { name: sessionMaterial.title }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: t('event.media') })
        .getByRole('link', { name: sessionMaterial.title }),
    ).toBeHidden();
  });

  test('offers the recording of an event that is over', async ({ page }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, PAST_EVENT.slug));

    const media = page.getByRole('region', { name: t('event.media') });
    await expect(
      media.getByRole('link', { name: recording.title }),
    ).toHaveAttribute('href', recording.url);
    // Recordings before materials, which is the order of the kinds (F52).
    const kinds = await media
      .getByRole('heading', { level: 3 })
      .allInnerTexts();
    expect(kinds).toEqual([
      t('mediaLinks.kind.recording.many'),
      t('mediaLinks.kind.material.many'),
    ]);
  });
});

test.describe('the tiles on the landing page', () => {
  const tiles = (page: Page) =>
    page.getByRole('navigation', { name: t('event.tiles.label') });

  test('offers a tile per part of this page that has something in it', async ({
    page,
  }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug));

    // The count comes from the fixture rather than from a literal: what the tile
    // has to say is how much is behind it. The keynote's slides are *not*
    // counted in the media tile — they hang on a session, and the media section
    // does not render them either.
    const programme = tiles(page).getByRole('link', {
      name: t('event.program'),
    });
    await expect(programme).toContainText(
      t('event.tiles.sessions.many', { count: PROGRAM_ITEMS.length }),
    );
    // The address is this event's own, with the fragment appended: a bare `#…`
    // would resolve against the client's `<base href>` and leave the event.
    await expect(programme).toHaveAttribute(
      'href',
      `${landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug)}#program`,
    );

    const media = tiles(page).getByRole('link', { name: t('event.media') });
    await expect(media).toContainText(t('event.tiles.links.one', { count: 1 }));
    await expect(media).toHaveAttribute(
      'href',
      `${landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug)}#media`,
    );
  });

  test('leads to the section instead of navigating away', async ({ page }) => {
    const address = landingPage(PUBLISHED_SERIES.slug, UPCOMING_EVENT.slug);
    await page.goto(address);

    await tiles(page)
      .getByRole('link', { name: t('event.program') })
      .click();

    // The same page, scrolled: everything a tile can lead to renders here, so a
    // tile that navigated would need a second rendering of the same timeline.
    await expect(page).toHaveURL(new RegExp(`${address}#program$`));
    await expect(
      page.getByRole('region', { name: t('event.program') }),
    ).toBeInViewport();
  });

  test('has no tile for a section that is not there', async ({ page }) => {
    await page.goto(landingPage(PUBLISHED_SERIES.slug, PAST_EVENT.slug));

    // The past event has a recording and no sessions. A tile leading to an empty
    // section would be a dead end drawn as a feature (F47's rule, again).
    await expect(
      tiles(page).getByRole('link', { name: t('event.media') }),
    ).toBeVisible();
    await expect(
      tiles(page).getByRole('link', { name: t('event.program') }),
    ).toHaveCount(0);
  });
});
