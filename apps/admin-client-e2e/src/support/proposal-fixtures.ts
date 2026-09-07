import { request } from '@playwright/test';
import { Pool } from 'pg';
import { ADMIN_STORAGE_STATE, SERIES_SLUG_PREFIX } from './admin-session';

/**
 * An event with proposals waiting for a decision (FR 3.14) — AP 3 of phase 4.
 *
 * The series and the event go through the administrative API, like every other
 * fixture here; the **proposals** are written straight into the plug-in's own
 * table, and that is the same deliberate exception the registrations make:
 * submitting one through the endpoint needs a participant session, so the
 * fixture would be a seeded account, a seeded session and one HTTP call per row
 * — for rows this suite only ever reads and decides on.
 *
 * That a submission really produces such a row is asserted where it belongs:
 * in `apps/server-e2e` against the endpoint, and in the participant client's
 * own suite in a browser. Here the subject under test is the organizer's
 * screen.
 *
 * The author is a confirmed account that is **not** in the directory
 * (`searchable` false). That is not incidental: the plug-in resolves an
 * author's name through a host port that does not ask for an opt-in (E37, AP 2
 * of phase 4), and a fixture that opted in would not notice if that ever
 * changed.
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4300';

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

export interface SeededProposals {
  readonly seriesId: string;
  readonly eventId: string;
  readonly eventName: string;
  readonly authorId: string;
  readonly authorEmail: string;
  readonly authorName: string;
  /** Two waiting proposals, in the order they were written. */
  readonly titles: readonly string[];
}

interface Created {
  id: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seedProposals(label: string): Promise<SeededProposals> {
  const context = await request.newContext({
    baseURL: CLIENT_URL,
    storageState: ADMIN_STORAGE_STATE,
  });

  try {
    const series: Created = await (
      await context.post('/api/admin/series', {
        data: {
          name: `${SERIES_SLUG_PREFIX}proposals ${label}`,
          description: 'Holds the event whose proposals the suite moderates.',
          status: 'published',
        },
      })
    ).json();

    const eventName = `Proposals Event ${label}`;
    const event: Created = await (
      await context.post(`/api/admin/series/${series.id}/events`, {
        data: {
          name: eventName,
          description: 'Its participants have suggested sessions.',
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

    // The address carries the label, because it is unique instance-wide (E31)
    // and three engines seed at the same time.
    const authorEmail = `proposals.${label}@proposals-admin-e2e.example.org`;
    const authorName = `Amina Okonkwo ${label}`;
    const author = await db().query<{ id: string }>(
      `INSERT INTO user_profile
         (email, password_hash, first_name, last_name, preferred_locale,
          searchable, confirmed_at)
       VALUES ($1, 'not-a-usable-hash', 'Amina', $2, 'en', false, now())
       RETURNING id`,
      [authorEmail, `Okonkwo ${label}`],
    );
    const authorId = author.rows[0].id;

    const titles = [
      `A workshop on election observation ${label}`,
      `A panel on counting ${label}`,
    ];
    for (const title of titles) {
      await db().query(
        `INSERT INTO plugin_program_proposals_proposal
           (event_id, author_id, title, description, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [
          event.id,
          authorId,
          title,
          'Half a day, hands on, and it needs tables.',
        ],
      );
    }

    return {
      seriesId: series.id,
      eventId: event.id,
      eventName,
      authorId,
      authorEmail,
      authorName,
      titles,
    };
  } finally {
    await context.dispose();
  }
}

/** How many of this event's proposals are in each state, straight from SQL. */
export async function proposalStates(
  eventId: string,
): Promise<Record<string, number>> {
  const rows = await db().query<{ status: string; count: string }>(
    `SELECT status, count(*) AS count
       FROM plugin_program_proposals_proposal
      WHERE event_id = $1
      GROUP BY status`,
    [eventId],
  );
  return Object.fromEntries(
    rows.rows.map((row) => [row.status, Number(row.count)]),
  );
}

/**
 * Removes the author — which takes the proposals with it — and then the series.
 *
 * The order is the one the foreign keys dictate: `author_id` cascades, so
 * deleting the account is what clears the plug-in's table, and the account has
 * to go by address because it is instance-wide (E31). The series is deleted
 * through the API, which the fixture is allowed to do here: nothing confirmed
 * hangs on this event (E14).
 */
export async function removeProposals(seeded: SeededProposals): Promise<void> {
  await db().query('DELETE FROM user_profile WHERE id = $1', [seeded.authorId]);

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

export async function closeProposalDatabase(): Promise<void> {
  await pool?.end();
  pool = null;
}
