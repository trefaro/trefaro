import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STORAGE_STATE, fixtureLabel } from './support/admin-session';
import { t } from './support/catalogue';

/**
 * Managing events in the browser (UC 04, UC 05, FR 3.1, FR 3.2, FR 3.9).
 *
 * The series each test works in is seeded through the API with the browser's own
 * session — creating it through the UI is what `event-series.spec.ts` covers,
 * and repeating it here would only make this spec slower and its failures
 * ambiguous. Deleting the series removes its events with it.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

/** Wall clock, as `<input type="datetime-local">` wants it. */
const START = '2027-03-28T09:00';
const END = '2027-03-30T17:00';

async function seedSeries(page: Page, label: string): Promise<string> {
  const response = await page.request.post('/api/admin/series', {
    data: {
      // Named for this spec, not just `E2E Series`: `event-series.spec.ts`
      // derives its slug from the same words, and two workers landing in the
      // same millisecond raced on the unique index — one of them got a 409 and
      // the failure read as a broken fixture. The prefix the global teardown
      // sweeps by is unchanged.
      name: `E2E Series Events ${label}`,
      description: 'Seeded by the organizer client event spec.',
      status: 'published',
    },
  });
  expect(response.ok()).toBe(true);
  const { id } = (await response.json()) as { id: string };
  return id;
}

test.describe('event administration', () => {
  let seriesId = '';

  test.beforeEach(async ({ page }, testInfo) => {
    seriesId = await seedSeries(page, fixtureLabel(testInfo.project.name));
  });

  test.afterEach(async ({ page }) => {
    if (seriesId) await page.request.delete(`/api/admin/series/${seriesId}`);
  });

  test('creates a hybrid event, publishes it and deletes it', async ({
    page,
  }) => {
    const name = 'Hybrid Kickoff';

    await page.goto(`/series/${seriesId}`);
    await expect(page.getByText(t('admin.series.noUpcoming'))).toBeVisible();

    await page.getByRole('link', { name: t('admin.events.new') }).click();
    await page.getByLabel(t('admin.events.name'), { exact: true }).fill(name);
    await page
      .getByLabel(t('admin.events.description'))
      .fill('On site and online at once.');
    await page.getByLabel(t('admin.events.type')).selectOption('hybrid');
    await page
      .getByLabel(t('admin.events.timezone'))
      .selectOption('Europe/Berlin');
    await page.getByLabel(t('admin.events.startsAt')).fill(START);
    await page.getByLabel(t('admin.events.endsAt')).fill(END);
    // Both fields appear only because the type is hybrid (FR 3.9).
    await page
      .getByLabel(t('admin.events.venueName'), { exact: true })
      .fill('Bürgerhaus Kalk');
    await page
      .getByLabel(t('admin.events.venueAddress'), { exact: true })
      .fill('Kalk-Mülheimer Str. 58, Köln');
    await page
      .getByLabel(t('admin.events.onlineUrl'))
      .fill('https://stream.example.org/kickoff');
    await page.getByRole('button', { name: t('admin.common.save') }).click();

    // Back on the series, with the event under "Upcoming events".
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await expect(row).toContainText(t('admin.eventType.hybrid'));
    await expect(row).toContainText(t('eventStatus.draft'));
    // Rendered in the event's zone, not the browser's (E8).
    await expect(row).toContainText('09:00');
    await expect(row).toContainText(/GMT\+[12]/);

    await row.getByRole('button', { name: t('admin.series.publish') }).click();
    await expect(row).toContainText(t('eventStatus.published'));

    page.once('dialog', (dialog) => void dialog.accept());
    await row.getByRole('button', { name: t('admin.common.delete') }).click();

    await expect(row).toBeHidden();
  });

  test('hides the venue fields for an online event', async ({ page }) => {
    await page.goto(`/series/${seriesId}/events/new`);

    await page.getByLabel(t('admin.events.type')).selectOption('online');

    // A field that does not apply is a field that gets filled in wrongly.
    await expect(
      page.getByLabel(t('admin.events.venueName'), { exact: true }),
    ).toBeHidden();
    await expect(page.getByLabel(t('admin.events.onlineUrl'))).toBeVisible();

    await page.getByLabel(t('admin.events.type')).selectOption('onsite');
    await expect(
      page.getByLabel(t('admin.events.venueName'), { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(t('admin.events.onlineUrl'))).toBeHidden();
  });

  test('reports the reason when an event cannot be published yet', async ({
    page,
  }) => {
    await page.goto(`/series/${seriesId}/events/new`);

    await page
      .getByLabel(t('admin.events.name'), { exact: true })
      .fill('Online Without Link');
    await page
      .getByLabel(t('admin.events.description'))
      .fill('The link is not booked yet.');
    await page.getByLabel(t('admin.events.type')).selectOption('online');
    await page.getByLabel(t('admin.events.startsAt')).fill(START);
    await page.getByLabel(t('admin.events.endsAt')).fill(END);
    await page.getByLabel(t('admin.events.status')).selectOption('published');
    await page.getByRole('button', { name: t('admin.common.save') }).click();

    // The server's rule, surfaced where the organizer can act on it.
    await expect(page.getByRole('alert')).toContainText('needs a link');
    await expect(page).toHaveURL(/\/events\/new$/);
  });

  test('keeps the address of an event that is renamed', async ({ page }) => {
    await page.goto(`/series/${seriesId}/events/new`);
    await page
      .getByLabel(t('admin.events.name'), { exact: true })
      .fill('Original Event');
    await page
      .getByLabel(t('admin.events.description'))
      .fill('Gets renamed in a moment.');
    await page.getByLabel(t('admin.events.startsAt')).fill(START);
    await page.getByLabel(t('admin.events.endsAt')).fill(END);
    await page
      .getByLabel(t('admin.events.venueName'), { exact: true })
      .fill('Alte Feuerwache');
    await page.getByRole('button', { name: t('admin.common.save') }).click();

    // The event's name leads to its dashboard now (FR 3.8); the form is one
    // click further, exactly as with a series and its detail page.
    await page.getByRole('link', { name: 'Original Event' }).click();
    await page.getByRole('link', { name: t('admin.events.edit') }).click();
    await expect(
      page.getByLabel(t('admin.events.name'), { exact: true }),
    ).toHaveValue('Original Event');
    const address = await page
      .getByLabel(t('admin.events.publicAddress'))
      .inputValue();
    await page
      .getByLabel(t('admin.events.name'), { exact: true })
      .fill('Renamed Event');
    await page.getByRole('button', { name: t('admin.common.save') }).click();

    // Saving returns to the dashboard, which shows the public address — so the
    // assertion is about what participants would see, not about a form field.
    await expect(
      page.getByRole('heading', { name: 'Renamed Event', level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(`/events/${address}`)).toBeVisible();
  });

  test('keeps a follow-up text that is written before the event (F50)', async ({
    page,
  }) => {
    const followUp = 'Thank you for coming. The recordings follow next week.';

    await page.goto(`/series/${seriesId}/events/new`);
    await page
      .getByLabel(t('admin.events.name'), { exact: true })
      .fill('Event With A Sequel');
    await page
      .getByLabel(t('admin.events.description'))
      .fill('Ends with a thank-you note.');
    await page.getByLabel(t('admin.events.startsAt')).fill(START);
    await page.getByLabel(t('admin.events.endsAt')).fill(END);
    await page
      .getByLabel(t('admin.events.venueName'), { exact: true })
      .fill('Alte Feuerwache');
    await page.getByLabel(t('admin.events.followUp')).fill(followUp);
    await page.getByRole('button', { name: t('admin.common.save') }).click();

    await page.getByRole('link', { name: 'Event With A Sequel' }).click();
    await page.getByRole('link', { name: t('admin.events.edit') }).click();

    // Read back whenever it was written: the organizer is the person writing
    // it, and the field says when participants will see it — which is not now,
    // because this event is in 2027.
    await expect(page.getByLabel(t('admin.events.followUp'))).toHaveValue(
      followUp,
    );
    await expect(
      page.getByText(t('admin.events.followUpPending')),
    ).toBeVisible();
  });
});
