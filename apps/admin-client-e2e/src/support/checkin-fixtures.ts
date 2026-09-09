import { request } from '@playwright/test';
import { Pool } from 'pg';
import { ADMIN_STORAGE_STATE } from './admin-session';

/**
 * An event with people expected at its door (FR 3.16) — AP 8 of phase 4.
 *
 * The series and the event go through the administrative API, like every other
 * fixture here. The **registrations** are written straight into the core table,
 * the same deliberate exception the room planning fixture makes: the real way
 * to a confirmed registration is a double opt-in over two mails, and that whole
 * path is walked in the participant suite and in the API contract suite. What
 * this suite needs is three states in one event — and the plug-in learns of
 * them through the host's port alone (E53), which is what the admission list on
 * the screen then proves.
 *
 * Its own event, and this plug-in needs that more than the others do: the
 * admission list is **every confirmed registration of one event**, so a shared
 * fixture event would put whatever the other suites registered into the list
 * under test.
 *
 * **No tickets.** Issuing them is what the plug-in does on the first read, and
 * a fixture that wrote codes would be testing the seed.
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

export interface SeededAttendee {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
}

export interface SeededDoor {
  readonly seriesId: string;
  readonly eventId: string;
  readonly eventName: string;
  /** Two confirmed people, in the order the list puts them: by name. */
  readonly expected: readonly SeededAttendee[];
  /** One who never confirmed and one who gave up — neither gets a ticket. */
  readonly absentFromList: readonly SeededAttendee[];
}

interface Created {
  id: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seedDoor(label: string): Promise<SeededDoor> {
  const context = await request.newContext({
    baseURL: CLIENT_URL,
    storageState: ADMIN_STORAGE_STATE,
  });

  try {
    const series: Created = await (
      await context.post('/api/admin/series', {
        data: {
          name: `E2E check-in ${label}`,
          description: 'Holds the event whose door this suite stands at.',
          status: 'published',
        },
      })
    ).json();

    const day = new Date(Date.now() + 40 * DAY_MS);
    day.setUTCHours(0, 0, 0, 0);
    const at = (hours: number): string =>
      new Date(day.getTime() + hours * 60 * 60 * 1000).toISOString();

    const eventName = `E2E Check-in Event ${label}`;
    const event: Created = await (
      await context.post(`/api/admin/series/${series.id}/events`, {
        data: {
          name: eventName,
          description: 'On site, with somebody at the door.',
          eventType: 'onsite',
          startsAt: at(6),
          endsAt: at(16),
          timezone: 'Europe/Berlin',
          venueName: 'E2E Bürgerhaus Kalk',
          languages: ['de', 'en'],
          status: 'published',
        },
      })
    ).json();

    const register = async (
      firstName: string,
      lastName: string,
      status: 'confirmed' | 'pending' | 'cancelled',
    ): Promise<SeededAttendee> => {
      const rows = await db().query<{ id: string }>(
        `INSERT INTO registration
           (event_id, email, first_name, last_name, status, confirmed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         RETURNING id`,
        [
          event.id,
          `${firstName.toLowerCase()}.${label}@checkin-admin-e2e.example.org`,
          firstName,
          lastName,
          status,
          // Somebody who cancelled had confirmed first; only the pending one
          // never did. Decided here rather than in the statement: the same
          // parameter cannot be both an enum and a string to compare against,
          // and PostgreSQL says so rather than guessing.
          status === 'pending' ? null : new Date(),
        ],
      );
      return { id: rows.rows[0].id, firstName, lastName };
    };

    // Two who are expected, and two who are not: the list is confirmed
    // registrations only, and that rule lives in the host adapter (E53, F152).
    const amina = await register('Amina', `Aa ${label}`, 'confirmed');
    const bo = await register('Bo', `Bb ${label}`, 'confirmed');
    const chen = await register('Chen', `Cc ${label}`, 'pending');
    const dara = await register('Dara', `Dd ${label}`, 'cancelled');

    return {
      seriesId: series.id,
      eventId: event.id,
      eventName,
      expected: [amina, bo],
      absentFromList: [chen, dara],
    };
  } finally {
    await context.dispose();
  }
}

/** Whether a registration has been let in, straight out of the plug-in's table. */
export async function admittedAt(registrationId: string): Promise<Date | null> {
  const rows = await db().query<{ checked_in_at: Date | null }>(
    `SELECT checked_in_at FROM plugin_qr_checkin_ticket WHERE registration_id = $1`,
    [registrationId],
  );
  return rows.rows[0]?.checked_in_at ?? null;
}

/** How many tickets this event's registrations hold. */
export async function ticketsOf(eventId: string): Promise<number> {
  const rows = await db().query<{ count: string }>(
    `SELECT count(*) AS count
       FROM plugin_qr_checkin_ticket ticket
       JOIN registration reg ON reg.id = ticket.registration_id
      WHERE reg.event_id = $1`,
    [eventId],
  );
  return Number(rows.rows[0].count);
}

/**
 * Removes the registrations, then the series that held them.
 *
 * The registrations by SQL first, because the endpoint refuses a series with
 * confirmed registrations (E14) — and deleting them takes the plug-in's
 * tickets with them, through the plug-in's own foreign key (F21).
 */
export async function removeDoor(seeded: SeededDoor): Promise<void> {
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

export async function closeDoorDatabase(): Promise<void> {
  await pool?.end();
  pool = null;
}
