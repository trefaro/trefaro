import { expect, test, type Page } from '@playwright/test';
import {
  ADMIN_STORAGE_STATE,
  SERIES_SLUG_PREFIX,
} from './support/admin-session';

/**
 * Planning an event's programme in the browser (FR 3.7) — AP 8.
 *
 * What this suite is for, beyond the API contract suite that already covers the
 * rules: the times an organizer types are read in the *event's* zone, not their
 * own browser's (E8). A server test cannot show that — it sends instants, and
 * the conversion is exactly the step in between.
 *
 * The series and the event are seeded through the API with the browser's own
 * session; creating them through the UI is what `events.spec.ts` covers.
 * Deleting the series takes the event and its programme with it.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

/**
 * A one-day event in Cologne, 09:00 to 18:00 local.
 *
 * Written as wall-clock plus offset rather than as a UTC instant, so the numbers
 * below are the ones the page is expected to show. September is summer time in
 * Europe/Berlin, so the offset is +02:00 — and an item at 10:00 local is 08:00
 * UTC, which is what makes the zone conversion visible at all.
 */
const EVENT_START = '2027-09-14T09:00:00+02:00';
const EVENT_END = '2027-09-14T18:00:00+02:00';

interface Seeded {
  seriesId: string;
  eventId: string;
}

async function seed(page: Page, label: string): Promise<Seeded> {
  const series = await page.request.post('/api/admin/series', {
    data: {
      name: `${SERIES_SLUG_PREFIX}programme ${label}`,
      description: 'Seeded by the organizer client programme spec.',
      status: 'published',
    },
  });
  // The status and the body in the message: a bare `ok()` assertion here says
  // only that the fixture failed, not why.
  expect(`${series.status()} ${await series.text()}`).toMatch(/^201/);
  const { id: seriesId } = (await series.json()) as { id: string };

  const event = await page.request.post(
    `/api/admin/series/${seriesId}/events`,
    {
      data: {
        name: `Programme Event ${label}`,
        description: 'The event whose programme is planned here.',
        eventType: 'onsite',
        startsAt: new Date(EVENT_START).toISOString(),
        endsAt: new Date(EVENT_END).toISOString(),
        timezone: 'Europe/Berlin',
        venueName: 'Bürgerhaus Kalk',
        languages: ['de'],
        status: 'published',
      },
    },
  );
  expect(`${event.status()} ${await event.text()}`).toMatch(/^201/);
  const { id: eventId } = (await event.json()) as { id: string };

  return { seriesId, eventId };
}

test.describe('the programme of an event', () => {
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
    page.goto(`/series/${seeded.seriesId}/events/${seeded.eventId}/program`);

  const sessions = (page: Page) =>
    page.getByRole('region', { name: 'Sessions' }).getByRole('listitem');

  /**
   * The card of one session, found by the clock it shows.
   *
   * By the clock rather than by the topic: the topic sits in an input value,
   * which is not text a locator can match — and the clock is what the tests here
   * are actually about.
   */
  const session = (page: Page, clock: string) =>
    sessions(page).filter({ hasText: clock });

  const addForm = (page: Page) =>
    page.getByRole('region', { name: 'Add a session' });

  /** Fills the add form with a wall-clock start and end in the event's zone. */
  const fill = async (
    page: Page,
    topic: string,
    startsAt: string,
    endsAt: string,
  ): Promise<void> => {
    const form = addForm(page);
    await form.getByLabel('Topic').fill(topic);
    await form.getByLabel('Starts').fill(startsAt);
    await form.getByLabel('Ends').fill(endsAt);
    await form.getByRole('button', { name: 'Add session' }).click();
  };

  /**
   * The same, and waits until the session is actually saved.
   *
   * The form clears itself once the server has answered. Typing the next session
   * before that would be typing into a form about to be reset — which is why the
   * form closes while a request is in flight, and why this waits for it to open
   * again rather than for a card to appear.
   */
  const fillSaved = async (
    page: Page,
    topic: string,
    startsAt: string,
    endsAt: string,
  ): Promise<void> => {
    await fill(page, topic, startsAt, endsAt);
    await expect(addForm(page).getByLabel('Topic')).toHaveValue('');
  };

  test('is reachable from the event and starts out empty', async ({ page }) => {
    await page.goto(`/series/${seeded.seriesId}/events/${seeded.eventId}`);

    await page.getByRole('link', { name: 'Programme' }).click();

    await expect(
      page.getByRole('heading', { name: 'Programme', level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText('No sessions yet', { exact: false }),
    ).toBeVisible();
    // The zone every time on the page is written in, said once and up front.
    await expect(
      page.getByText('every time below is in that zone'),
    ).toBeVisible();
  });

  test('adds a session and lists it under its day, in the event zone', async ({
    page,
  }) => {
    await open(page);

    await fill(page, 'Keynote', '2027-09-14T10:00', '2027-09-14T11:30');

    // The clock the organizer typed, read back unchanged: the value went out as
    // 08:00 UTC and has to come back as 10:00 in Cologne (E8). A page that read
    // the instant in the browser's own zone would fail here on any CI runner.
    await expect(session(page, '10:00–11:30')).toBeVisible();
    await expect(session(page, '10:00–11:30').getByLabel('Topic')).toHaveValue(
      'Keynote',
    );
    // The day heading names the day and the zone.
    await expect(
      page.getByRole('heading', { name: /September 14, 2027/ }),
    ).toBeVisible();
  });

  test('keeps the speaker and the abstract', async ({ page }) => {
    await open(page);

    const form = addForm(page);
    await form.getByLabel('Topic').fill('Opening words');
    await form.getByLabel('Speaker').fill('Dr. Amara Nwosu');
    await form.getByLabel('Description').fill('Where we stand, and why.');
    await form.getByLabel('Starts').fill('2027-09-14T09:30');
    await form.getByLabel('Ends').fill('2027-09-14T10:00');
    await form.getByRole('button', { name: 'Add session' }).click();

    const card = session(page, '09:30–10:00');
    await expect(card.getByLabel('Speaker')).toHaveValue('Dr. Amara Nwosu');
    await expect(card.getByLabel('Description')).toHaveValue(
      'Where we stand, and why.',
    );
  });

  test('refuses a session outside the event, and says which period was meant', async ({
    page,
  }) => {
    await open(page);

    // 20:00 local, two hours after the event ends.
    await fill(page, 'After hours', '2027-09-14T20:00', '2027-09-14T21:00');

    await expect(page.getByRole('alert')).toContainText(
      'has to happen while the event does',
    );
    // The period, in the event's own zone — the organizer has to see which day
    // was meant, not just that this one was wrong.
    await expect(page.getByRole('alert')).toContainText('09:00–18:00');
    await expect(sessions(page)).toHaveCount(0);
  });

  test('marks two sessions that share their time rather than refusing them', async ({
    page,
  }) => {
    await open(page);

    await fillSaved(page, 'Track A', '2027-09-14T14:00', '2027-09-14T15:00');
    await fillSaved(page, 'Track B', '2027-09-14T14:00', '2027-09-14T15:00');

    // Parallel tracks are legitimate (F41) — both are kept, and both are marked.
    await expect(sessions(page)).toHaveCount(2);
    await expect(
      page.getByText('runs alongside another session').first(),
    ).toBeVisible();
    await expect(page.getByRole('status')).toContainText(
      'share their time with another',
    );
  });

  test('moves a session by changing its time, and reorders the list', async ({
    page,
  }) => {
    await open(page);

    await fillSaved(page, 'Lunch', '2027-09-14T12:00', '2027-09-14T13:00');
    await fillSaved(page, 'Keynote', '2027-09-14T16:00', '2027-09-14T17:00');

    // The clock is the order (F40), so the keynote sits last while it is at 16:00.
    await expect(sessions(page).first()).toContainText('12:00–13:00');

    const keynote = session(page, '16:00–17:00');
    await keynote.getByLabel('Starts').fill('2027-09-14T10:00');
    await keynote.getByLabel('Ends').fill('2027-09-14T11:00');
    await keynote.getByRole('button', { name: 'Save' }).click();

    // Moving it is what reorders the programme — there is no "move up".
    await expect(sessions(page).first()).toContainText('10:00–11:00');
    await expect(sessions(page).nth(1)).toContainText('12:00–13:00');
  });

  test('refuses a move that leaves the event', async ({ page }) => {
    await open(page);

    await fill(page, 'Workshop', '2027-09-14T11:00', '2027-09-14T12:00');

    const card = session(page, '11:00–12:00');
    await card.getByLabel('Ends').fill('2027-09-14T23:00');
    await card.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'has to happen while the event does',
    );
    // The card is still the one that was there — nothing was half-written.
    await expect(session(page, '11:00–12:00')).toBeVisible();
  });

  test('removes a session after asking', async ({ page }) => {
    await open(page);

    await fill(page, 'Cancelled talk', '2027-09-14T15:30', '2027-09-14T16:00');
    await expect(session(page, '15:30–16:00')).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await session(page, '15:30–16:00')
      .getByRole('button', { name: 'Delete' })
      .click();

    await expect(sessions(page)).toHaveCount(0);
    await expect(
      page.getByText('No sessions yet', { exact: false }),
    ).toBeVisible();
  });
});
