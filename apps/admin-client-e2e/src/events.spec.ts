import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './support/admin-session';

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
      // The teardown deletes by the slug this name produces.
      name: `E2E Series ${label}`,
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
    seriesId = await seedSeries(page, `${testInfo.project.name} ${Date.now()}`);
  });

  test.afterEach(async ({ page }) => {
    if (seriesId) await page.request.delete(`/api/admin/series/${seriesId}`);
  });

  test('creates a hybrid event, publishes it and deletes it', async ({
    page,
  }) => {
    const name = 'Hybrid Kickoff';

    await page.goto(`/series/${seriesId}`);
    await expect(
      page.getByText('No upcoming events. Create the first one.'),
    ).toBeVisible();

    await page.getByRole('link', { name: 'New event' }).click();
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('Description').fill('On site and online at once.');
    await page.getByLabel('Event type').selectOption('hybrid');
    await page.getByLabel('Time zone').selectOption('Europe/Berlin');
    await page.getByLabel('Starts').fill(START);
    await page.getByLabel('Ends').fill(END);
    // Both fields appear only because the type is hybrid (FR 3.9).
    await page.getByLabel('Venue', { exact: true }).fill('Bürgerhaus Kalk');
    await page
      .getByLabel('Address', { exact: true })
      .fill('Kalk-Mülheimer Str. 58, Köln');
    await page
      .getByLabel('Online link')
      .fill('https://stream.example.org/kickoff');
    await page.getByRole('button', { name: 'Save' }).click();

    // Back on the series, with the event under "Upcoming events".
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('hybrid');
    await expect(row).toContainText('draft');
    // Rendered in the event's zone, not the browser's (E8).
    await expect(row).toContainText('09:00');
    await expect(row).toContainText(/GMT\+[12]/);

    await row.getByRole('button', { name: 'Publish' }).click();
    await expect(row).toContainText('published');

    page.once('dialog', (dialog) => void dialog.accept());
    await row.getByRole('button', { name: 'Delete' }).click();

    await expect(row).toBeHidden();
  });

  test('hides the venue fields for an online event', async ({ page }) => {
    await page.goto(`/series/${seriesId}/events/new`);

    await page.getByLabel('Event type').selectOption('online');

    // A field that does not apply is a field that gets filled in wrongly.
    await expect(page.getByLabel('Venue', { exact: true })).toBeHidden();
    await expect(page.getByLabel('Online link')).toBeVisible();

    await page.getByLabel('Event type').selectOption('onsite');
    await expect(page.getByLabel('Venue', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Online link')).toBeHidden();
  });

  test('reports the reason when an event cannot be published yet', async ({
    page,
  }) => {
    await page.goto(`/series/${seriesId}/events/new`);

    await page.getByLabel('Name', { exact: true }).fill('Online Without Link');
    await page.getByLabel('Description').fill('The link is not booked yet.');
    await page.getByLabel('Event type').selectOption('online');
    await page.getByLabel('Starts').fill(START);
    await page.getByLabel('Ends').fill(END);
    await page.getByLabel('Status').selectOption('published');
    await page.getByRole('button', { name: 'Save' }).click();

    // The server's rule, surfaced where the organizer can act on it.
    await expect(page.getByRole('alert')).toContainText('needs a link');
    await expect(page).toHaveURL(/\/events\/new$/);
  });

  test('keeps the address of an event that is renamed', async ({ page }) => {
    await page.goto(`/series/${seriesId}/events/new`);
    await page.getByLabel('Name', { exact: true }).fill('Original Event');
    await page.getByLabel('Description').fill('Gets renamed in a moment.');
    await page.getByLabel('Starts').fill(START);
    await page.getByLabel('Ends').fill(END);
    await page.getByLabel('Venue', { exact: true }).fill('Alte Feuerwache');
    await page.getByRole('button', { name: 'Save' }).click();

    await page.getByRole('link', { name: 'Original Event' }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(
      'Original Event',
    );
    const address = await page.getByLabel('Public address').inputValue();
    await page.getByLabel('Name', { exact: true }).fill('Renamed Event');
    await page.getByRole('button', { name: 'Save' }).click();

    await page.getByRole('link', { name: 'Renamed Event' }).click();
    await expect(page.getByLabel('Public address')).toHaveValue(address);
  });
});
