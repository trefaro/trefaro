import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectNoRawKeys } from './support/catalogue';
import { asAdmin } from './support/series-fixtures';

/**
 * Content in the reader's language (FR 3.12, E25) — phase 2, AP 11.
 *
 * The acceptance criterion of the work package, seen from where it matters: an
 * event with a German translation reads German on the German page and English on
 * the English one, a session nobody translated shows its original rather than a
 * gap, and the address is the same string either way.
 *
 * Only a browser can show the part that is the actual risk. The translation
 * happens on the *server*, so a language switch has to fetch the page again —
 * a client that merely re-rendered would keep the sentences it already had, and
 * every unit test of the pipe would still pass.
 *
 * Its own series per run rather than the shared fixtures: three browser engines
 * read those, and a German name on the shared event would change what the other
 * suites see.
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4200';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Unique across every worker of a run, without a clock — see AP 12's note. */
let sequence = 0;

function fixtureLabel(engine: string): string {
  sequence += 1;
  return `translations-${engine}-${process.pid}-${sequence}`;
}

const at = (offsetDays: number, hour: number): string =>
  new Date(
    Date.UTC(1970, 0, 1, hour) +
      Math.trunc(Date.now() / DAY_MS + offsetDays) * DAY_MS,
  ).toISOString();

interface Created {
  id: string;
  slug: string;
}

interface Translated {
  seriesId: string;
  seriesSlug: string;
  eventSlug: string;
  englishName: string;
  germanName: string;
  englishDescription: string;
  untranslatedSession: string;
  translatedSession: string;
  germanSession: string;
  address: string;
}

async function seed(
  admin: APIRequestContext,
  label: string,
): Promise<Translated> {
  const englishName = `E2E Translated Event ${label}`;
  const germanName = `E2E Übersetzte Veranstaltung ${label}`;
  const englishDescription = `E2E untranslated description ${label}`;
  const address = 'Kalker Hauptstraße 247, 51103 Köln';

  const series: Created = await (
    await admin.post('/api/admin/series', {
      data: {
        name: `E2E Translated Series ${label}`,
        description: `Holds the event this suite translates (${label}).`,
        status: 'published',
      },
    })
  ).json();

  const event: Created = await (
    await admin.post(`/api/admin/series/${series.id}/events`, {
      data: {
        name: englishName,
        description: englishDescription,
        eventType: 'onsite',
        startsAt: at(60, 8),
        endsAt: at(60, 16),
        timezone: 'Europe/Berlin',
        venueName: 'Town Hall',
        venueAddress: address,
        languages: ['en'],
        status: 'published',
      },
    })
  ).json();

  const translatedSession = `E2E Keynote ${label}`;
  const untranslatedSession = `E2E Untranslated session ${label}`;
  const germanSession = `E2E Eröffnungsvortrag ${label}`;

  const sessions: Created[] = [];
  for (const [title, from, to] of [
    [translatedSession, 9, 10],
    [untranslatedSession, 11, 12],
  ] as const) {
    sessions.push(
      await (
        await admin.post(`/api/admin/events/${event.id}/program-items`, {
          data: { title, startsAt: at(60, from), endsAt: at(60, to) },
        })
      ).json(),
    );
  }

  // Deliberately partial: the name has a translation, the description does not,
  // and one of the two sessions has none at all. That is what "field by field
  // and additive" has to look like on a page (E25).
  await admin.put(`/api/admin/events/${event.id}/translations/de`, {
    data: { name: germanName, venueName: 'Rathaus' },
  });
  await admin.put(
    `/api/admin/program-items/${sessions[0].id}/translations/de`,
    { data: { title: germanSession } },
  );

  return {
    seriesId: series.id,
    seriesSlug: series.slug,
    eventSlug: event.slug,
    englishName,
    germanName,
    englishDescription,
    untranslatedSession,
    translatedSession,
    germanSession,
    address,
  };
}

test.describe('content in the reader’s language', () => {
  let admin: APIRequestContext;
  let seeded: Translated | null = null;

  test.beforeAll(async () => {
    admin = await asAdmin(CLIENT_URL);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  test.afterEach(async () => {
    if (!seeded) return;
    // The cascade takes the events, the sessions and their translations with
    // the series — which is the whole reason nobody has to tidy them up.
    await admin.delete(`/api/admin/series/${seeded.seriesId}`);
    seeded = null;
  });

  test('switches the event itself, not only the interface', async ({
    page,
    browserName,
  }) => {
    seeded = await seed(admin, fixtureLabel(browserName));
    await page.goto(`/series/${seeded.seriesSlug}/events/${seeded.eventSlug}`);

    await expect(
      page.getByRole('heading', { name: seeded.englishName }),
    ).toBeVisible();

    await page.getByRole('combobox').selectOption('de');

    // The translation lives on the server, so this only passes if the page
    // fetched the event again. A client that merely re-rendered would still be
    // showing the English name here.
    await expect(
      page.getByRole('heading', { name: seeded.germanName }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expectNoRawKeys(page);
  });

  test('falls back field by field, so nothing is missing', async ({
    page,
    browserName,
  }) => {
    seeded = await seed(admin, fixtureLabel(browserName));
    await page.goto(`/series/${seeded.seriesSlug}/events/${seeded.eventSlug}`);
    await page.getByRole('combobox').selectOption('de');
    await expect(
      page.getByRole('heading', { name: seeded.germanName }),
    ).toBeVisible();

    // The description was never translated: the original stands, rather than a
    // hole where a paragraph should be.
    await expect(page.getByText(seeded.englishDescription)).toBeVisible();
    // The venue name was: "Rathaus" and "Town Hall" are the same building.
    await expect(page.getByText('Rathaus')).toBeVisible();
    // The address never is — a translated street sends people to a place that
    // does not exist.
    await expect(page.getByText(seeded.address)).toBeVisible();
  });

  test('translates the programme session by session', async ({
    page,
    browserName,
  }) => {
    seeded = await seed(admin, fixtureLabel(browserName));
    await page.goto(`/series/${seeded.seriesSlug}/events/${seeded.eventSlug}`);

    await expect(page.getByText(seeded.translatedSession)).toBeVisible();

    await page.getByRole('combobox').selectOption('de');

    await expect(page.getByText(seeded.germanSession)).toBeVisible();
    // The other session has no translation and keeps its own title — an
    // untranslated line reads as untranslated, an empty one as broken.
    await expect(page.getByText(seeded.untranslatedSession)).toBeVisible();
  });

  test('translates the series on the start page as well', async ({
    page,
    browserName,
  }) => {
    seeded = await seed(admin, fixtureLabel(browserName));
    const germanSeries = `E2E Übersetzte Reihe ${browserName}-${process.pid}`;
    await admin.put(`/api/admin/series/${seeded.seriesId}/translations/de`, {
      data: { name: germanSeries },
    });

    await page.goto('/');
    await page.getByRole('combobox').selectOption('de');

    await expect(page.getByText(germanSeries)).toBeVisible();
  });
});
