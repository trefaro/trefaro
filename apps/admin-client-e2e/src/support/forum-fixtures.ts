import { request } from '@playwright/test';
import { Pool } from 'pg';
import { ADMIN_STORAGE_STATE, SERIES_SLUG_PREFIX } from './admin-session';

/**
 * An event with a thread whose posts wait for a decision (FR 4.6) — AP 5 of
 * phase 4.
 *
 * The series and the event go through the administrative API, like every other
 * fixture here; the **thread and its posts** are written straight into the
 * plug-in's own tables, and that is the same deliberate exception the proposals
 * make: opening a thread through the endpoint needs a participant session, so
 * the fixture would be a seeded account, a seeded session and one HTTP call per
 * row — for rows this suite only ever reads and decides on.
 *
 * That opening a thread really produces these rows is asserted where it
 * belongs: in `apps/server-e2e` against the endpoint, and in the participant
 * client's own suite in a browser. Here the subject under test is the
 * organizer's screen.
 *
 * The author is a confirmed account that is **not** in the directory
 * (`searchable` false), for the reason the proposals give: the plug-in resolves
 * an author's name through a host port that does not ask for an opt-in (E37),
 * and a fixture that opted in would not notice if that ever changed.
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

export interface SeededForum {
  readonly seriesId: string;
  readonly eventId: string;
  readonly eventName: string;
  readonly authorId: string;
  readonly authorEmail: string;
  readonly authorName: string;
  readonly threadTitle: string;
  /** Two waiting posts in the one thread, in the order they were written. */
  readonly bodies: readonly string[];
}

interface Created {
  id: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seedForum(label: string): Promise<SeededForum> {
  const context = await request.newContext({
    baseURL: CLIENT_URL,
    storageState: ADMIN_STORAGE_STATE,
  });

  try {
    const series: Created = await (
      await context.post('/api/admin/series', {
        data: {
          name: `${SERIES_SLUG_PREFIX}forum ${label}`,
          description: 'Holds the event whose forum the suite moderates.',
          status: 'published',
        },
      })
    ).json();

    const eventName = `Forum Event ${label}`;
    const event: Created = await (
      await context.post(`/api/admin/series/${series.id}/events`, {
        data: {
          name: eventName,
          description: 'Its participants talk with each other.',
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
    const authorEmail = `forum.${label}@forum-admin-e2e.example.org`;
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

    const threadTitle = `Where to meet ${label}`;
    const thread = await db().query<{ id: string }>(
      `INSERT INTO plugin_forum_thread (event_id, title, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [event.id, threadTitle, authorId],
    );

    const bodies = [
      `In front of the main entrance? ${label}`,
      `Or at the tram stop, if it rains. ${label}`,
    ];
    for (const body of bodies) {
      await db().query(
        `INSERT INTO plugin_forum_post (thread_id, author_id, body, status)
         VALUES ($1, $2, $3, 'pending')`,
        [thread.rows[0].id, authorId, body],
      );
    }

    return {
      seriesId: series.id,
      eventId: event.id,
      eventName,
      authorId,
      authorEmail,
      authorName,
      threadTitle,
      bodies,
    };
  } finally {
    await context.dispose();
  }
}

/** How many of this event's posts are in each state, straight from SQL. */
export async function forumStates(
  eventId: string,
): Promise<Record<string, number>> {
  const rows = await db().query<{ status: string; count: string }>(
    `SELECT post.status, count(*) AS count
       FROM plugin_forum_post post
       JOIN plugin_forum_thread thread ON thread.id = post.thread_id
      WHERE thread.event_id = $1
      GROUP BY post.status`,
    [eventId],
  );
  return Object.fromEntries(
    rows.rows.map((row) => [row.status, Number(row.count)]),
  );
}

/**
 * Removes the author — which takes the thread and its posts with it — and then
 * the series.
 *
 * The order is the one the foreign keys dictate: `created_by` and `author_id`
 * cascade, so deleting the account is what clears the plug-in's tables, and the
 * account has to go by id because its address is instance-wide (E31). The
 * series is deleted through the API, which the fixture is allowed to do here:
 * nothing confirmed hangs on this event (E14).
 */
export async function removeForum(seeded: SeededForum): Promise<void> {
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

export async function closeForumDatabase(): Promise<void> {
  await pool?.end();
  pool = null;
}
