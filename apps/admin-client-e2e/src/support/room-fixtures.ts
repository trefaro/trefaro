import { request } from '@playwright/test';
import { Pool } from 'pg';
import { ADMIN_STORAGE_STATE, SERIES_SLUG_PREFIX } from './admin-session';

/**
 * An event with three sessions and three people in one of them (FR 3.11) —
 * AP 6 of phase 4.
 *
 * The series, the event and the sessions go through the administrative API,
 * like every other fixture here. The **registrations and their seats** are
 * written straight into the core tables, the same deliberate exception the
 * participants' fixture makes: the real way to a seat is a link the server
 * mailed after a double opt-in, and that whole path is walked elsewhere. What
 * this suite needs is a session that is fuller than a room — and the plug-in
 * learns that number through the host's port alone (F45), which is what the
 * overbooking warning on the screen then proves.
 *
 * **No rooms.** Adding, changing and deleting them is what the suite does in
 * the browser; a fixture that created them would test the seed.
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

export interface SeededSession {
  readonly id: string;
  readonly title: string;
}

export interface SeededRoomPlan {
  readonly seriesId: string;
  readonly eventId: string;
  readonly eventName: string;
  /** Nine to ten, with three people signed up. */
  readonly plenary: SeededSession;
  /** Eleven to half past twelve. */
  readonly workshop: SeededSession;
  /** Half past eleven to twelve — overlapping the workshop. */
  readonly panel: SeededSession;
}

interface Created {
  id: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seedRoomPlan(label: string): Promise<SeededRoomPlan> {
  const context = await request.newContext({
    baseURL: CLIENT_URL,
    storageState: ADMIN_STORAGE_STATE,
  });

  try {
    const series: Created = await (
      await context.post('/api/admin/series', {
        data: {
          name: `${SERIES_SLUG_PREFIX}rooms ${label}`,
          description: 'Holds the event whose rooms the suite plans.',
          status: 'published',
        },
      })
    ).json();

    const eventName = `Room Plan Event ${label}`;
    const day = new Date(Date.now() + 60 * DAY_MS);
    day.setUTCHours(0, 0, 0, 0);
    const at = (hours: number, minutes = 0): string =>
      new Date(
        day.getTime() + (hours * 60 + minutes) * 60 * 1000,
      ).toISOString();

    const event: Created = await (
      await context.post(`/api/admin/series/${series.id}/events`, {
        data: {
          name: eventName,
          description: 'On site, with rooms.',
          eventType: 'onsite',
          startsAt: at(6),
          endsAt: at(16),
          timezone: 'Europe/Berlin',
          venueName: 'E2E Bürgerhaus Kalk',
          languages: ['de'],
          status: 'published',
        },
      })
    ).json();

    const session = async (
      title: string,
      from: string,
      to: string,
      seats?: number,
    ): Promise<SeededSession> => {
      const created: Created = await (
        await context.post(`/api/admin/events/${event.id}/program-items`, {
          data: {
            title,
            startsAt: from,
            endsAt: to,
            ...(seats === undefined
              ? {}
              : { registrationEnabled: true, capacity: seats }),
          },
        })
      ).json();
      return { id: created.id, title };
    };
    const plenary = await session(
      `Opening plenary ${label}`,
      at(9),
      at(10),
      60,
    );
    const workshop = await session(`Door-to-door ${label}`, at(11), at(12, 30));
    const panel = await session(`Panel ${label}`, at(11, 30), at(12));

    // Three confirmed people, each with a seat in the plenary — the number a
    // room with two chairs is overbooked by.
    for (const firstName of ['Amina', 'Bo', 'Chen']) {
      const registration = await db().query<{ id: string }>(
        `INSERT INTO registration
           (event_id, email, first_name, last_name, status, confirmed_at, created_at)
         VALUES ($1, $2, $3, $4, 'confirmed', now(), now())
         RETURNING id`,
        [
          event.id,
          `${firstName.toLowerCase()}.${label}@rooms-admin-e2e.example.org`,
          firstName,
          `Rooms ${label}`,
        ],
      );
      await db().query(
        `INSERT INTO program_item_signup (program_item_id, registration_id)
         VALUES ($1, $2)`,
        [plenary.id, registration.rows[0].id],
      );
    }

    return {
      seriesId: series.id,
      eventId: event.id,
      eventName,
      plenary,
      workshop,
      panel,
    };
  } finally {
    await context.dispose();
  }
}

/** The rooms of the event as the database has them, by name. */
export async function roomsOf(
  eventId: string,
): Promise<{ name: string; capacity: number }[]> {
  const rows = await db().query<{ name: string; capacity: number }>(
    `SELECT name, capacity
       FROM plugin_room_planning_room
      WHERE event_id = $1
      ORDER BY name`,
    [eventId],
  );
  return rows.rows;
}

/** How many sessions sit in a room of this event, whichever room. */
export async function assignmentsOf(eventId: string): Promise<number> {
  const rows = await db().query<{ count: string }>(
    `SELECT count(*) AS count
       FROM plugin_room_planning_program_item_room link
       JOIN plugin_room_planning_room room ON room.id = link.room_id
      WHERE room.event_id = $1`,
    [eventId],
  );
  return Number(rows.rows[0].count);
}

/**
 * Removes the registrations, then the series that held them.
 *
 * The registrations by SQL first, because the endpoint refuses a series with
 * confirmed registrations (E14). The series through the API — which takes the
 * event, its sessions, and through the plug-in's own foreign keys (F21) every
 * room and every assignment the suite made.
 */
export async function removeRoomPlan(seeded: SeededRoomPlan): Promise<void> {
  await db().query('DELETE FROM registration WHERE event_id = $1', [
    seeded.eventId,
  ]);

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

export async function closeRoomDatabase(): Promise<void> {
  await pool?.end();
  pool = null;
}
