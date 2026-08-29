import { expect, test, type Page } from '@playwright/test';
import {
  ADMIN_STORAGE_STATE,
  SERIES_SLUG_PREFIX,
  fixtureLabel,
} from './support/admin-session';
import { t, tPattern } from './support/catalogue';

/**
 * Planning an event's programme in the browser (FR 3.7, FR 3.10) — AP 8 and AP 9.
 *
 * What this suite is for, beyond the API contract suite that already covers the
 * rules: the times an organizer types are read in the *event's* zone, not their
 * own browser's (E8). A server test cannot show that — it sends instants, and
 * the conversion is exactly the step in between.
 *
 * The sign-up block at the end is here for the same kind of reason: the seat
 * field only exists while the switch is on, and switching it off clears the
 * seats. Both are things the page does before anything is sent, so only a
 * browser can show them.
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
    seeded = await seed(page, fixtureLabel(testInfo.project.name));
  });

  test.afterEach(async ({ page }) => {
    if (seeded.seriesId) {
      await page.request.delete(`/api/admin/series/${seeded.seriesId}`);
    }
  });

  const open = (page: Page) =>
    page.goto(`/series/${seeded.seriesId}/events/${seeded.eventId}/program`);

  const sessions = (page: Page) =>
    page
      .getByRole('region', { name: t('admin.program.sessions') })
      .getByRole('listitem');

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
    page.getByRole('region', { name: t('admin.program.add') });

  /** Fills the add form with a wall-clock start and end in the event's zone. */
  const fill = async (
    page: Page,
    topic: string,
    startsAt: string,
    endsAt: string,
  ): Promise<void> => {
    const form = addForm(page);
    await form.getByLabel(t('admin.program.topic')).fill(topic);
    await form.getByLabel(t('admin.events.startsAt')).fill(startsAt);
    await form.getByLabel(t('admin.events.endsAt')).fill(endsAt);
    await form
      .getByRole('button', { name: t('admin.program.addSubmit') })
      .click();
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
    await expect(
      addForm(page).getByLabel(t('admin.program.topic')),
    ).toHaveValue('');
  };

  test('is reachable from the event and starts out empty', async ({ page }) => {
    await page.goto(`/series/${seeded.seriesId}/events/${seeded.eventId}`);

    await page.getByRole('link', { name: t('admin.program.title') }).click();

    await expect(
      page.getByRole('heading', { name: t('admin.program.title'), level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(t('admin.program.empty'))).toBeVisible();
    // The zone every time on the page is written in, said once and up front.
    // The period is formatted from the event, so the sentence is matched with
    // its placeholder open rather than with an English fragment.
    await expect(
      page.getByText(tPattern('admin.program.runsIn')),
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
    await expect(
      session(page, '10:00–11:30').getByLabel(t('admin.program.topic')),
    ).toHaveValue('Keynote');
    // The day heading names the day and the zone.
    await expect(
      page.getByRole('heading', { name: /September 14, 2027/ }),
    ).toBeVisible();
  });

  test('keeps the speaker and the abstract', async ({ page }) => {
    await open(page);

    const form = addForm(page);
    await form.getByLabel(t('admin.program.topic')).fill('Opening words');
    await form.getByLabel(t('admin.program.speaker')).fill('Dr. Amara Nwosu');
    await form
      .getByLabel(t('admin.program.description'))
      .fill('Where we stand, and why.');
    await form.getByLabel(t('admin.events.startsAt')).fill('2027-09-14T09:30');
    await form.getByLabel(t('admin.events.endsAt')).fill('2027-09-14T10:00');
    await form
      .getByRole('button', { name: t('admin.program.addSubmit') })
      .click();

    const card = session(page, '09:30–10:00');
    await expect(card.getByLabel(t('admin.program.speaker'))).toHaveValue(
      'Dr. Amara Nwosu',
    );
    await expect(card.getByLabel(t('admin.program.description'))).toHaveValue(
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
      page.getByText(t('admin.program.badgeClash')).first(),
    ).toBeVisible();
    await expect(page.getByRole('status')).toContainText(
      t('admin.program.clashHint', { count: 2 }),
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
    await keynote
      .getByLabel(t('admin.events.startsAt'))
      .fill('2027-09-14T10:00');
    await keynote.getByLabel(t('admin.events.endsAt')).fill('2027-09-14T11:00');
    await keynote.getByRole('button', { name: t('admin.common.save') }).click();

    // Moving it is what reorders the programme — there is no "move up".
    await expect(sessions(page).first()).toContainText('10:00–11:00');
    await expect(sessions(page).nth(1)).toContainText('12:00–13:00');
  });

  test('refuses a move that leaves the event', async ({ page }) => {
    await open(page);

    await fill(page, 'Workshop', '2027-09-14T11:00', '2027-09-14T12:00');

    const card = session(page, '11:00–12:00');
    await card.getByLabel(t('admin.events.endsAt')).fill('2027-09-14T23:00');
    await card.getByRole('button', { name: t('admin.common.save') }).click();

    await expect(page.getByRole('alert')).toContainText(
      'has to happen while the event does',
    );
    // The card is still the one that was there — nothing was half-written.
    await expect(session(page, '11:00–12:00')).toBeVisible();
  });

  test('turns sign-up on with a seat limit, and off again', async ({
    page,
  }) => {
    await open(page);
    await fillSaved(page, 'Workshop', '2027-09-14T13:00', '2027-09-14T14:00');

    const card = session(page, '13:00–14:00');
    // No seat field while the session is simply attended: a limit without
    // sign-up is refused by the server and would be a field with no meaning.
    await expect(card.getByLabel(t('admin.program.seats'))).toBeHidden();

    await card.getByLabel(t('admin.program.askWhoIsComing')).check();
    await card.getByLabel(t('admin.program.seats')).fill('12');
    await card.getByRole('button', { name: t('admin.common.save') }).click();

    await expect(
      session(page, '13:00–14:00').getByText(
        t('admin.program.takeUpLimit', { count: 0, capacity: 12, left: 12 }),
      ),
    ).toBeVisible();

    // Switching it off takes the limit with it, on the page as on the server.
    await session(page, '13:00–14:00')
      .getByLabel(t('admin.program.askWhoIsComing'))
      .uncheck();
    await expect(
      session(page, '13:00–14:00').getByLabel(t('admin.program.seats')),
    ).toBeHidden();
    await session(page, '13:00–14:00')
      .getByRole('button', { name: t('admin.common.save') })
      .click();

    await expect(page.getByRole('alert')).toBeHidden();
    await expect(
      session(page, '13:00–14:00').getByText(
        tPattern('admin.program.takeUpLimit'),
      ),
    ).toBeHidden();
  });

  test('adds a session that asks who is coming straight away', async ({
    page,
  }) => {
    await open(page);

    const form = addForm(page);
    await form.getByLabel(t('admin.program.topic')).fill('Guided tour');
    await form.getByLabel(t('admin.events.startsAt')).fill('2027-09-14T15:00');
    await form.getByLabel(t('admin.events.endsAt')).fill('2027-09-14T16:00');
    await expect(form.getByLabel(t('admin.program.seats'))).toBeHidden();
    await form.getByLabel(t('admin.program.askWhoIsComing')).check();
    await form.getByLabel(t('admin.program.seats')).fill('8');
    await form
      .getByRole('button', { name: t('admin.program.addSubmit') })
      .click();

    await expect(
      session(page, '15:00–16:00').getByText(
        t('admin.program.takeUpLimit', { count: 0, capacity: 8, left: 8 }),
      ),
    ).toBeVisible();
  });

  test('shows who signed up, with the address in the row', async ({ page }) => {
    await open(page);
    await fillSaved(page, 'Workshop', '2027-09-14T13:00', '2027-09-14T14:00');

    const card = session(page, '13:00–14:00');
    await card.getByLabel(t('admin.program.askWhoIsComing')).check();
    await card.getByRole('button', { name: t('admin.common.save') }).click();
    // The whole line, not just "signed up": the button beside it says the same
    // two words, and a locator that matches both is a strict-mode violation.
    await expect(
      session(page, '13:00–14:00').getByText(
        t('admin.program.takeUpNoLimit', { count: 0 }),
      ),
    ).toBeVisible();

    await session(page, '13:00–14:00')
      .getByRole('button', { name: t('admin.program.whoSignedUp') })
      .click();

    // Nobody yet, said as such rather than as an empty table.
    await expect(
      page.getByText(t('admin.program.nobodySignedUp')),
    ).toBeVisible();

    await session(page, '13:00–14:00')
      .getByRole('button', { name: t('admin.program.hideList') })
      .click();
    await expect(
      page.getByText(t('admin.program.nobodySignedUp')),
    ).toBeHidden();
  });

  test('asks before deleting, naming the session', async ({ page }) => {
    await open(page);
    await fillSaved(page, 'Workshop', '2027-09-14T13:00', '2027-09-14T14:00');

    let asked = '';
    page.once('dialog', (dialog) => {
      asked = dialog.message();
      void dialog.dismiss();
    });
    await session(page, '13:00–14:00')
      .getByRole('button', { name: t('admin.common.delete') })
      .click();

    // Dismissed, so nothing is gone — and the question named the session. With
    // sign-ups the message also says how many seats are about to be released;
    // that half is not assertable from here, because only a participant can
    // create a sign-up and only through their own link (E11).
    expect(asked).toContain('Workshop');
    await expect(sessions(page)).toHaveCount(1);
  });

  test('removes a session after asking', async ({ page }) => {
    await open(page);

    await fill(page, 'Cancelled talk', '2027-09-14T15:30', '2027-09-14T16:00');
    await expect(session(page, '15:30–16:00')).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await session(page, '15:30–16:00')
      .getByRole('button', { name: t('admin.common.delete') })
      .click();

    await expect(sessions(page)).toHaveCount(0);
    await expect(page.getByText(t('admin.program.empty'))).toBeVisible();
  });
});
