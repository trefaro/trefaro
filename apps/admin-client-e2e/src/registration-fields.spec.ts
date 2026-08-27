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
  /** The public address of the series — the upload test registers through it. */
  seriesSlug: string;
  eventId: string;
  eventSlug: string;
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
  // The status and the body in the message: a bare `ok()` assertion here says
  // only that the fixture failed, not why.
  expect(`${series.status()} ${await series.text()}`).toMatch(/^201/);
  const { id: seriesId, slug: seriesSlug } = (await series.json()) as {
    id: string;
    slug: string;
  };

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
  expect(`${event.status()} ${await event.text()}`).toMatch(/^201/);
  const { id: eventId, slug: eventSlug } = (await event.json()) as {
    id: string;
    slug: string;
  };

  return { seriesId, seriesSlug, eventId, eventSlug };
}

test.describe('the registration form of an event', () => {
  let seeded: Seeded = {
    seriesId: '',
    seriesSlug: '',
    eventId: '',
    eventSlug: '',
  };

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

  test('adds a question that asks for a file, with the types it takes', async ({
    page,
  }) => {
    await open(page);

    const form = addForm(page);
    await form.getByLabel('Question').fill('Passport scan');
    await form.getByLabel('Kind of answer').selectOption('file');
    // The catalogue, not a text box for MIME types (F38): an organizer who could
    // type one could accept an executable.
    await form.getByRole('checkbox', { name: 'PDF' }).check();
    await form.getByLabel('Largest file (MB)').fill('2');
    await form.getByRole('button', { name: 'Add question' }).click();

    const card = question(page, 'passport-scan');
    await expect(card.getByText('file', { exact: true })).toBeVisible();
    await expect(card.getByRole('checkbox', { name: 'PDF' })).toBeChecked();
    await expect(card.getByLabel('Largest file (MB)')).toHaveValue('2');
  });

  test('refuses a file question that accepts nothing, with the reason', async ({
    page,
  }) => {
    await open(page);

    const form = addForm(page);
    await form.getByLabel('Question').fill('Passport scan');
    await form.getByLabel('Kind of answer').selectOption('file');
    await form.getByRole('button', { name: 'Add question' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'at least one accepted file type',
    );
  });

  test('hands a collected file back to the organizer as a download', async ({
    page,
  }) => {
    await open(page);

    // The question is built through the interface, so this test covers the seam
    // between the form an organizer defines and the file it collects.
    const form = addForm(page);
    await form.getByLabel('Question').fill('Passport scan');
    await form.getByLabel('Kind of answer').selectOption('file');
    await form.getByRole('checkbox', { name: 'PDF' }).check();
    await form.getByRole('button', { name: 'Add question' }).click();
    await expect(question(page, 'passport-scan')).toBeVisible();

    // The registration itself goes in through the public endpoint: filling in
    // the participant form in a browser is what the participant client's own
    // suite covers.
    const email = `e2e-upload-${Date.now()}@files.example.org`;
    const submitted = await page.request.post(
      `/api/user/series/${seeded.seriesSlug}/events/${seeded.eventSlug}/registrations`,
      {
        multipart: {
          payload: JSON.stringify({
            firstName: 'Amina',
            lastName: 'Okonkwo',
            email,
          }),
          'passport-scan': {
            name: 'Reisepass.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('%PDF-1.7\nseeded by the organizer suite\n'),
          },
        },
      },
    );
    expect(submitted.status()).toBe(202);

    await page.goto(
      `/series/${seeded.seriesId}/events/${seeded.eventId}/participants`,
    );
    await page.getByRole('link', { name: 'Okonkwo, Amina' }).click();

    // The name the participant's file had, which is the only thing that says
    // whose document it is.
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Reisepass.pdf' }).click();

    expect((await download).suggestedFilename()).toBe('Reisepass.pdf');
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
