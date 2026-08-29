import { expect, request, test, type Page } from '@playwright/test';
import { ADMIN_STORAGE_STATE, fixtureLabel } from './support/admin-session';
import {
  FILLER_ROWS,
  PARTICIPANTS,
  closeFixtureDatabase,
  removeParticipants,
  seedParticipants,
  type SeededEvent,
} from './support/registration-fixtures';
import { t } from './support/catalogue';

/**
 * The event dashboard in the browser (FR 3.8) — AP 10.
 *
 * The acceptance criterion of the work package has two halves, and both are
 * assertions about the screen rather than about the API: the numbers correspond
 * to a real data situation, and every tile leads to the view it summarizes. So
 * this spec reads the tiles of an event that has registrations, a programme and
 * a form, and then clicks its way from each tile to the page behind it.
 *
 * The registrations come from the same fixture the participant overview uses —
 * two confirmed, one cancelled, and twenty-five awaiting confirmation. The
 * programme and the form are added through the API here, because what is under
 * test is the dashboard, not the two editors that have their own specs.
 *
 * Each browser engine seeds its own event, because three of them run this spec
 * against one instance.
 */
test.use({ storageState: ADMIN_STORAGE_STATE });

const PENDING = PARTICIPANTS.filter((row) => row.status === 'pending').length;
const CONFIRMED = PARTICIPANTS.filter(
  (row) => row.status === 'confirmed',
).length;
const CANCELLED = PARTICIPANTS.filter(
  (row) => row.status === 'cancelled',
).length;
/** The filler rows are all awaiting confirmation. */
const AWAITING = PENDING + FILLER_ROWS;

test.describe('event dashboard', () => {
  let seeded: SeededEvent;

  test.beforeAll(async () => {
    seeded = await seedParticipants(fixtureLabel(test.info().project.name));

    // Two sessions, one of which asks who is coming, and one required question:
    // enough for every tile to have something to say that is not a zero.
    const context = await request.newContext({
      baseURL: process.env['BASE_URL'] ?? 'http://localhost:4300',
      storageState: ADMIN_STORAGE_STATE,
    });
    try {
      const plan = (payload: Record<string, unknown>) =>
        context.post(`/api/admin/events/${seeded.eventId}/program-items`, {
          data: payload,
        });
      const start = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      const at = (hours: number): string =>
        new Date(start.getTime() + hours * 60 * 60 * 1000).toISOString();

      expect(
        (
          await plan({
            title: 'Dashboard Keynote',
            startsAt: at(1),
            endsAt: at(2),
          })
        ).ok(),
      ).toBe(true);
      expect(
        (
          await plan({
            title: 'Dashboard Workshop',
            startsAt: at(3),
            endsAt: at(4),
            registrationEnabled: true,
            capacity: 20,
          })
        ).ok(),
      ).toBe(true);
      expect(
        (
          await context.post(
            `/api/admin/events/${seeded.eventId}/registration-fields`,
            {
              data: {
                label: 'Dietary requirements',
                type: 'text',
                required: true,
              },
            },
          )
        ).ok(),
      ).toBe(true);
    } finally {
      await context.dispose();
    }
  });

  test.afterAll(async () => {
    if (seeded) await removeParticipants(seeded);
    await closeFixtureDatabase();
  });

  const dashboard = (): string =>
    `/series/${seeded.seriesId}/events/${seeded.eventId}`;

  const tile = (page: Page, name: string) =>
    page.getByRole('article').filter({ hasText: name });

  test('is what an event opens on, and says what is really there', async ({
    page,
  }) => {
    await page.goto(dashboard());

    await expect(
      page.getByRole('heading', { name: seeded.eventName, level: 1 }),
    ).toBeVisible();
    // The address participants are given, nested inside its series (E7, F28).
    await expect(
      page.getByText(`/series/${seeded.seriesSlug}/events/${seeded.eventSlug}`),
    ).toBeVisible();

    // Confirmed is the headline: it is who is actually coming.
    const participants = tile(page, t('admin.participants.title'));
    await expect(participants).toContainText(`${CONFIRMED}`);
    await expect(participants).toContainText(
      `${t('admin.dashboard.metaPending', { count: AWAITING })} · ` +
        t('admin.dashboard.metaCancelled', { count: CANCELLED }),
    );

    const programme = tile(page, t('admin.program.title'));
    await expect(programme).toContainText('2');
    await expect(programme).toContainText(
      t('admin.dashboard.metaSeats.manyOne', { seats: 0, sessions: 1 }),
    );

    const form = tile(page, t('admin.fields.title'));
    await expect(form).toContainText(`1 ${t('admin.dashboard.questions.one')}`);
    await expect(form).toContainText(
      t('admin.dashboard.metaRequired', { count: 1 }),
    );

    // The media links module ships switched on (FR 1.5), and this event has
    // nothing linked yet: a zero is right here, because the tile leads
    // somewhere. Its absence is what a switched-off module looks like (F53).
    const media = tile(page, t('modules.mediaLinks.title'));
    await expect(media).toContainText('0');
    await expect(media).toContainText(t('admin.dashboard.metaNoMedia'));
  });

  test('lists the newest registrations with their addresses', async ({
    page,
  }) => {
    await page.goto(dashboard());

    // Newest first: the arrival an organizer has not seen yet (FR 3.3).
    const newest = page.getByRole('row', { name: /Zimmermann, Dieter/ });
    await expect(newest).toBeVisible();
    // In the row, not behind a click (E13).
    await expect(newest).toContainText('@participants.example.org');
    // Five rows and a way to the rest.
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(6);
    await expect(
      page.getByRole('link', { name: t('admin.dashboard.allParticipants') }),
    ).toBeVisible();
  });

  test('leads from each tile to the view it summarizes', async ({ page }) => {
    await page.goto(dashboard());
    // Exact: "All participants" below the tiles leads to the same page, and a
    // substring match would find both.
    await page
      .getByRole('link', { name: t('admin.participants.title'), exact: true })
      .click();
    await expect(page).toHaveURL(/\/participants$/);

    await page.goto(dashboard());
    await page.getByRole('link', { name: t('admin.program.title') }).click();
    await expect(page).toHaveURL(/\/program$/);

    await page.goto(dashboard());
    await page.getByRole('link', { name: t('admin.fields.title') }).click();
    await expect(page).toHaveURL(/\/registration-form$/);

    await page.goto(dashboard());
    await page
      .getByRole('link', { name: t('modules.mediaLinks.title') })
      .click();
    await expect(page).toHaveURL(/\/media-links$/);

    await page.goto(dashboard());
    await page.getByRole('link', { name: t('admin.events.edit') }).click();
    await expect(page).toHaveURL(/\/edit$/);
    await expect(
      page.getByLabel(t('admin.dashboard.name'), { exact: true }),
    ).toHaveValue(seeded.eventName);
  });

  test('publishes and unpublishes the event where its numbers are', async ({
    page,
  }) => {
    await page.goto(dashboard());

    // The fixture publishes the event, so the first thing on offer is the
    // opposite.
    await page
      .getByRole('button', { name: t('admin.series.unpublish') })
      .click();
    await expect(
      page.getByText(t('eventStatus.draft'), { exact: true }),
    ).toBeVisible();

    await page.getByRole('button', { name: t('admin.series.publish') }).click();
    await expect(
      page.getByText(t('eventStatus.published'), { exact: true }),
    ).toBeVisible();
  });
});
