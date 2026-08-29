import { expect, test, type Page } from '@playwright/test';
import {
  ADMIN_STORAGE_STATE,
  SERIES_SLUG_PREFIX,
  fixtureLabel,
} from './support/admin-session';
import { t } from './support/catalogue';

/**
 * Translating content in the organizer client (FR 3.12, UC 12) — AP 11.
 *
 * What only a browser can show, beyond the API contract suite that covers the
 * rules themselves:
 *
 * - **The original stands beside the box**, which is what makes the screen a
 *   translation screen rather than a second form. A payload cannot show that.
 * - **A tab per target language, never for the default one.** The main form *is*
 *   the default language.
 * - **One save per thing.** The event and each session save separately, so a
 *   mistake in one does not throw away another — visible only by pressing one
 *   button and watching what the other section keeps.
 * - **Removing a translation leaves the original alone**, which is the sentence
 *   the page promises and the thing an organizer will be most afraid of.
 *
 * The series and the event are seeded through the API with the browser's own
 * session; deleting the series takes the event, the sessions and every
 * translation of them with it.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

const EVENT_START = '2027-09-14T09:00:00+02:00';
const EVENT_END = '2027-09-14T18:00:00+02:00';

const EVENT_NAME = 'Translation Event';
const EVENT_DESCRIPTION = 'The event whose translations are edited here.';
const SESSION_TITLE = 'Translation Keynote';

interface Seeded {
  seriesId: string;
  seriesName: string;
  eventId: string;
  sessionId: string;
}

async function seed(page: Page, label: string): Promise<Seeded> {
  const seriesName = `${SERIES_SLUG_PREFIX}translations ${label}`;
  const series = await page.request.post('/api/admin/series', {
    data: {
      name: seriesName,
      description: 'Seeded by the organizer client translations spec.',
      status: 'published',
    },
  });
  expect(`${series.status()} ${await series.text()}`).toMatch(/^201/);
  const { id: seriesId } = (await series.json()) as { id: string };

  const event = await page.request.post(
    `/api/admin/series/${seriesId}/events`,
    {
      data: {
        name: `${EVENT_NAME} ${label}`,
        description: EVENT_DESCRIPTION,
        eventType: 'onsite',
        startsAt: new Date(EVENT_START).toISOString(),
        endsAt: new Date(EVENT_END).toISOString(),
        timezone: 'Europe/Berlin',
        venueName: 'Town Hall',
        venueAddress: 'Kalker Hauptstraße 247, 51103 Köln',
        languages: ['en'],
        status: 'published',
      },
    },
  );
  expect(`${event.status()} ${await event.text()}`).toMatch(/^201/);
  const { id: eventId } = (await event.json()) as { id: string };

  const session = await page.request.post(
    `/api/admin/events/${eventId}/program-items`,
    {
      data: {
        title: `${SESSION_TITLE} ${label}`,
        startsAt: new Date('2027-09-14T10:00:00+02:00').toISOString(),
        endsAt: new Date('2027-09-14T11:00:00+02:00').toISOString(),
      },
    },
  );
  expect(`${session.status()} ${await session.text()}`).toMatch(/^201/);
  const { id: sessionId } = (await session.json()) as { id: string };

  return { seriesId, seriesName, eventId, sessionId };
}

test.describe('translating an event and its programme', () => {
  let seeded: Seeded = {
    seriesId: '',
    seriesName: '',
    eventId: '',
    sessionId: '',
  };

  test.beforeEach(async ({ page }, testInfo) => {
    seeded = await seed(page, fixtureLabel(testInfo.project.name));
  });

  test.afterEach(async ({ page }) => {
    if (seeded.seriesId) {
      await page.request.delete(`/api/admin/series/${seeded.seriesId}`);
    }
  });

  const openEvent = (page: Page) =>
    page.goto(
      `/series/${seeded.seriesId}/events/${seeded.eventId}/translations`,
    );

  const eventSection = (page: Page) =>
    page.getByRole('region', {
      name: t('admin.translations.eventSection'),
      exact: true,
    });

  const programSection = (page: Page) =>
    page.getByRole('region', {
      name: t('admin.translations.programSection'),
      exact: true,
    });

  /**
   * Presses one section's save button and waits for the write itself.
   *
   * Not for the "Saved." notice: it is one sentence for every section, so a
   * second save would find the first one's notice already on the screen and
   * pass before its own request had been sent — or failed.
   */
  const save = async (
    page: Page,
    section: ReturnType<typeof eventSection>,
    endpoint: RegExp,
  ): Promise<void> => {
    const written = page.waitForResponse(
      (response) =>
        endpoint.test(response.url()) && response.request().method() === 'PUT',
    );
    await section
      .getByRole('button', { name: t('admin.translations.save') })
      .click();
    expect((await written).ok()).toBe(true);
  };

  test('is reachable from the event and shows the original beside the boxes', async ({
    page,
  }) => {
    await page.goto(`/series/${seeded.seriesId}/events/${seeded.eventId}`);
    await page
      .getByRole('link', { name: t('admin.translations.link'), exact: true })
      .click();

    await expect(
      page.getByRole('heading', {
        name: t('admin.translations.title'),
        level: 1,
      }),
    ).toBeVisible();
    // The original next to the box, not inside it as a placeholder: a
    // placeholder disappears exactly when a translator wants to compare.
    await expect(eventSection(page).getByText(EVENT_DESCRIPTION)).toBeVisible();
    await expect(
      eventSection(page).getByLabel(t('admin.events.name')),
    ).toHaveValue('');
  });

  test('offers a tab per target language and never for the default one', async ({
    page,
  }) => {
    await openEvent(page);

    const tabs = page.getByRole('tab');
    // This instance ships English and German and runs in English, so German is
    // the one target language — English is the main form.
    await expect(tabs).toHaveCount(1);
    await expect(tabs.first()).toHaveText('German');
  });

  test('saves the event and each session on its own', async ({ page }) => {
    await openEvent(page);

    const germanName = 'Übersetzte Veranstaltung';
    const germanSession = 'Übersetzter Eröffnungsvortrag';

    await eventSection(page)
      .getByLabel(t('admin.events.name'))
      .fill(germanName);
    await save(
      page,
      eventSection(page),
      /\/api\/admin\/events\/.*\/translations\//,
    );
    await expect(page.getByText(t('admin.translations.saved'))).toBeVisible();

    // The session was not saved with it: one save per thing, so a refusal in
    // one section cannot throw away another.
    await expect(
      programSection(page).getByLabel(t('admin.program.topic')),
    ).toHaveValue('');

    await programSection(page)
      .getByLabel(t('admin.program.topic'))
      .fill(germanSession);
    await save(
      page,
      programSection(page),
      /\/api\/admin\/program-items\/.*\/translations\//,
    );

    await page.reload();

    await expect(
      eventSection(page).getByLabel(t('admin.events.name')),
    ).toHaveValue(germanName);
    await expect(
      programSection(page).getByLabel(t('admin.program.topic')),
    ).toHaveValue(germanSession);
  });

  test('removes a translation and leaves the original untouched', async ({
    page,
  }) => {
    await openEvent(page);

    await eventSection(page)
      .getByLabel(t('admin.events.name'))
      .fill('Übersetzte Veranstaltung');
    await save(
      page,
      eventSection(page),
      /\/api\/admin\/events\/.*\/translations\//,
    );

    await eventSection(page)
      .getByRole('button', { name: t('admin.translations.remove') })
      .click();
    await expect(page.getByText(t('admin.translations.removed'))).toBeVisible();

    await expect(
      eventSection(page).getByLabel(t('admin.events.name')),
    ).toHaveValue('');
    // What the organizer wrote is still what the organizer wrote.
    await expect(eventSection(page).getByText(EVENT_DESCRIPTION)).toBeVisible();
  });

  test('translates a series from its own page', async ({ page }) => {
    await page.goto(`/series/${seeded.seriesId}`);
    await page
      .getByRole('link', { name: t('admin.translations.link'), exact: true })
      .click();

    const germanName = 'Übersetzte Reihe';
    await page.getByLabel(t('admin.series.name')).fill(germanName);
    await save(
      page,
      page.locator('body'),
      /\/api\/admin\/series\/.*\/translations\//,
    );
    await expect(page.getByText(t('admin.translations.saved'))).toBeVisible();

    await page.reload();

    await expect(page.getByLabel(t('admin.series.name'))).toHaveValue(
      germanName,
    );
    // And the original is still the original: the link back to the series says
    // what the organizer typed, not what was translated.
    await expect(
      page.getByRole('link', { name: seeded.seriesName }),
    ).toBeVisible();
  });
});
