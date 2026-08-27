import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from './support/admin-session';

/**
 * Building an event's registration form in the browser (F12, FR 3.5) — AP 6.
 *
 * The series and the event are seeded through the API with the browser's own
 * session: creating them through the UI is what `event-series.spec.ts` and
 * `events.spec.ts` cover, and repeating it here would only make this spec slower
 * and its failures ambiguous. Deleting the series removes the event and its
 * form definition with it.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

const START = '2027-09-14T09:00';
const END = '2027-09-14T17:00';

interface Seeded {
  seriesId: string;
  eventId: string;
}

async function seed(page: Page, label: string): Promise<Seeded> {
  const series = await page.request.post('/api/admin/series', {
    data: {
      // The teardown deletes by the slug this name produces.
      name: `E2E Series Form ${label}`,
      description: 'Seeded by the organizer client registration form spec.',
      status: 'published',
    },
  });
  expect(series.ok()).toBe(true);
  const { id: seriesId } = (await series.json()) as { id: string };

  const event = await page.request.post(
    `/api/admin/series/${seriesId}/events`,
    {
      data: {
        name: `Form Event ${label}`,
        description: 'The event whose registration form is built here.',
        eventType: 'onsite',
        startsAt: new Date(`${START}:00Z`).toISOString(),
        endsAt: new Date(`${END}:00Z`).toISOString(),
        timezone: 'Europe/Berlin',
        venueName: 'Bürgerhaus Kalk',
        languages: ['de'],
        status: 'published',
      },
    },
  );
  expect(event.ok()).toBe(true);
  const { id: eventId } = (await event.json()) as { id: string };

  return { seriesId, eventId };
}

test.describe('the registration form of an event', () => {
  let seeded: Seeded = { seriesId: '', eventId: '' };

  test.beforeEach(async ({ page }, testInfo) => {
    seeded = await seed(page, `${testInfo.project.name} ${Date.now()}`);
  });

  test.afterEach(async ({ page }) => {
    if (seeded.seriesId) {
      await page.request.delete(`/api/admin/series/${seeded.seriesId}`);
    }
  });

  const open = (page: Page) =>
    page.goto(
      `/series/${seeded.seriesId}/events/${seeded.eventId}/registration-form`,
    );

  const questions = (page: Page) =>
    page.getByRole('region', { name: 'Your questions' }).getByRole('listitem');

  /**
   * The card of one question, found by its key.
   *
   * By the key rather than by the question itself: the wording sits in an input
   * value, which is not text a locator can match — and the key is the one thing
   * about a field that does not change.
   */
  const question = (page: Page, key: string) =>
    questions(page).filter({ hasText: key });

  const addForm = (page: Page) =>
    page.getByRole('region', { name: 'Add a question' });

  test('is reachable from the event and starts out empty', async ({ page }) => {
    await page.goto(`/series/${seeded.seriesId}/events/${seeded.eventId}`);

    await page.getByRole('link', { name: 'Registration form' }).click();

    await expect(
      page.getByRole('heading', { name: 'Registration form' }),
    ).toBeVisible();
    // The five standard fields are not managed here, and the page says so.
    await expect(
      page.getByText('No extra questions yet', { exact: false }),
    ).toBeVisible();
  });

  test('adds a question and shows the key its answers are stored under', async ({
    page,
  }) => {
    await open(page);

    const form = addForm(page);
    await form.getByLabel('Question').fill('Dietary requirements');
    await form.getByLabel('Explanation').fill('So the caterer knows.');
    await form.getByRole('button', { name: 'Add question' }).click();

    const card = question(page, 'dietary-requirements');
    await expect(card).toBeVisible();
    // The key is derived from the wording, and shown because it is what turns up
    // in an export later.
    await expect(card.getByLabel('Question')).toHaveValue(
      'Dietary requirements',
    );
    await expect(card.getByText('text', { exact: true })).toBeVisible();
  });

  test('offers the choices of a selection field as one line each', async ({
    page,
  }) => {
    await open(page);

    const form = addForm(page);
    await form.getByLabel('Question').fill('Meal');
    await form.getByLabel('Kind of answer').selectOption('select');
    // The choices box appears only for a selection field. Matched exactly: a
    // select element's accessible name carries its option text, and "one of
    // several choices" contains the word this box is called.
    await form
      .getByLabel('Choices', { exact: true })
      .fill('Vegan\nVegetarian\nNo preference\n\n');
    await form.getByRole('button', { name: 'Add question' }).click();

    const card = question(page, 'meal');
    await expect(card.getByText('select', { exact: true })).toBeVisible();
    // The blank line is dropped rather than turned into an empty choice.
    await expect(card.getByLabel('Choices', { exact: true })).toHaveValue(
      'Vegan\nVegetarian\nNo preference',
    );
  });

  test('refuses a selection field with no choices, with the reason', async ({
    page,
  }) => {
    await open(page);

    const form = addForm(page);
    await form.getByLabel('Question').fill('Meal');
    await form.getByLabel('Kind of answer').selectOption('select');
    await form.getByRole('button', { name: 'Add question' }).click();

    // The server's rule, surfaced where the organizer can act on it.
    await expect(page.getByRole('alert')).toContainText('at least one choice');
  });

  test('keeps the key when the question is reworded', async ({ page }) => {
    await open(page);

    const form = addForm(page);
    await form.getByLabel('Question').fill('Where do you come form?');
    await form.getByRole('button', { name: 'Add question' }).click();

    const card = question(page, 'where-do-you-come-form');
    await expect(card).toBeVisible();
    await card.getByLabel('Question').fill('Where do you come from?');
    await card.getByRole('button', { name: 'Save' }).click();

    // Same card, same key: rephrasing must not orphan the answers already given.
    await expect(card.getByLabel('Question')).toHaveValue(
      'Where do you come from?',
    );
    await expect(question(page, 'where-do-you-come-form')).toBeVisible();
  });

  test('moves a question and deletes it again', async ({ page }) => {
    await open(page);

    const form = addForm(page);
    for (const [label, key] of [
      ['First question', 'first-question'],
      ['Second question', 'second-question'],
    ]) {
      await form.getByLabel('Question').fill(label);
      await form.getByRole('button', { name: 'Add question' }).click();
      await expect(question(page, key)).toBeVisible();
    }

    const cards = questions(page);
    // Added at the end, so the first question is still the first.
    await expect(cards.first()).toContainText('first-question');

    await page
      .getByRole('button', { name: 'Move First question down' })
      .click();

    await expect(cards.first()).toContainText('second-question');

    page.once('dialog', (dialog) => void dialog.accept());
    await question(page, 'second-question')
      .getByRole('button', { name: 'Delete' })
      .click();

    await expect(question(page, 'second-question')).toBeHidden();
    await expect(question(page, 'first-question')).toBeVisible();
  });
});
