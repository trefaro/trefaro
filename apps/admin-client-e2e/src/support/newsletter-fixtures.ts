import { request } from '@playwright/test';
import { Pool } from 'pg';
import { ADMIN_STORAGE_STATE, SERIES_SLUG_PREFIX } from './admin-session';

/**
 * One consent from each source, for the overview to show (FR 4.8, E45).
 *
 * Written straight into the database, and the reason is the same one
 * `registration-fixtures.ts` gives, plus one of its own: **a consent cannot be
 * produced from outside without a mailbox.** Both sources end in a link
 * somebody has to click — the registration's double opt-in and the sign-up's —
 * and three browser engines following two links each would spend the mail
 * budget on a fixture.
 *
 * That the double opt-in really produces these rows is asserted where a mailbox
 * is part of the test: in `apps/server-e2e/src/api/newsletter.spec.ts` and in
 * the participant client's own suite, both against Mailpit. Here the subject is
 * the organizer's table.
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4300';

const DAY_MS = 24 * 60 * 60 * 1000;

let pool: Pool | null = null;

function db(): Pool {
  pool ??= new Pool({
    host: process.env['DATABASE_HOST'] ?? 'localhost',
    port: Number(process.env['DATABASE_PORT'] ?? 5432),
    user: process.env['DATABASE_USER'] ?? 'trefaro',
    password: process.env['DATABASE_PASSWORD'] ?? 'trefaro_dev',
    database: process.env['DATABASE_NAME'] ?? 'trefaro',
    max: 2,
  });
  return pool;
}

export interface SeededConsents {
  readonly seriesId: string;
  readonly seriesName: string;
  readonly eventId: string;
  /** Ticked the box while registering — the source with no row of its own. */
  readonly formEmail: string;
  /** Signed up in the app — the only source this screen can take back. */
  readonly appEmail: string;
  /** Never confirmed, so it must appear nowhere at all (E45). */
  readonly pendingEmail: string;
}

interface Created {
  id: string;
  slug: string;
}

export async function seedConsents(label: string): Promise<SeededConsents> {
  const context = await request.newContext({
    baseURL: CLIENT_URL,
    storageState: ADMIN_STORAGE_STATE,
  });

  const seriesName = `${SERIES_SLUG_PREFIX}newsletter ${label}`;
  const formEmail = `form.${label}@newsletter.example.org`;
  const appEmail = `app.${label}@newsletter.example.org`;
  const pendingEmail = `pending.${label}@newsletter.example.org`;

  try {
    const series: Created = await (
      await context.post('/api/admin/series', {
        data: {
          name: seriesName,
          description: 'Holds the consents the overview shows.',
          status: 'published',
        },
      })
    ).json();

    const event: Created = await (
      await context.post(`/api/admin/series/${series.id}/events`, {
        data: {
          name: `Newsletter Event ${label}`,
          description: 'The event whose form had the newsletter box.',
          eventType: 'onsite',
          startsAt: new Date(Date.now() + 60 * DAY_MS).toISOString(),
          endsAt: new Date(Date.now() + 61 * DAY_MS).toISOString(),
          timezone: 'Europe/Berlin',
          venueName: 'E2E Bürgerhaus Kalk',
          languages: ['de'],
          status: 'published',
        },
      })
    ).json();

    await db().query(
      `INSERT INTO registration
         (event_id, email, first_name, last_name, status, newsletter_opt_in,
          confirmed_at, created_at)
       VALUES ($1, $2, 'Amina', 'Okonkwo', 'confirmed', true, now(), now())`,
      [event.id, formEmail],
    );

    await db().query(
      `INSERT INTO newsletter_subscription
         (email, event_series_id, confirmed_at)
       VALUES ($1, $2, now()), ($3, $2, NULL)`,
      [appEmail, series.id, pendingEmail],
    );

    return {
      seriesId: series.id,
      seriesName,
      eventId: event.id,
      formEmail,
      appEmail,
      pendingEmail,
    };
  } finally {
    await context.dispose();
  }
}

/** Registrations first, then the series that held them (E14). */
export async function removeConsents(seeded: SeededConsents): Promise<void> {
  await db().query('DELETE FROM registration WHERE event_id = $1', [
    seeded.eventId,
  ]);
  // The sign-ups cascade with the series, but only the ones that name it: an
  // address removed by a test is already gone, and `DELETE` twice is not an
  // error.
  await db().query(
    'DELETE FROM newsletter_subscription WHERE email IN ($1, $2)',
    [seeded.appEmail, seeded.pendingEmail],
  );

  const context = await request.newContext({
    baseURL: CLIENT_URL,
    storageState: ADMIN_STORAGE_STATE,
  });
  try {
    await context.delete(`/api/admin/series/${seeded.seriesId}`);
  } finally {
    await context.dispose();
  }
}

export async function closeNewsletterDatabase(): Promise<void> {
  await pool?.end();
  pool = null;
}
