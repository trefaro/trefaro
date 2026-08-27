import { Pool } from 'pg';

/**
 * Direct database access for the API contract tests.
 *
 * Used for exactly one thing: putting registrations into the table in bulk. The
 * public registration endpoint is the wrong tool for that — it sends a mail per
 * attempt and is rate limited on purpose (AP 4) — and the load check of the
 * participant overview needs two thousand rows, not thirty.
 *
 * The rows it writes are ordinary registrations; every constraint the migration
 * declares still applies, so a fixture that the real flow could not produce
 * fails here too.
 *
 * Reads the same environment the server does, so a run against a different
 * database cannot silently seed the wrong one.
 */
const pool = new Pool({
  host: process.env['DATABASE_HOST'] ?? 'localhost',
  port: Number(process.env['DATABASE_PORT'] ?? 5432),
  user: process.env['DATABASE_USER'] ?? 'trefaro',
  password: process.env['DATABASE_PASSWORD'] ?? 'trefaro_dev',
  database: process.env['DATABASE_NAME'] ?? 'trefaro',
  max: 2,
});

export interface SeededRegistration {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly status: 'pending' | 'confirmed' | 'cancelled';
  readonly origin?: string | null;
  readonly newsletterOptIn?: boolean;
  /** ISO 8601; defaults to now. Set it to place a row in a given week. */
  readonly registeredAt?: string;
  /**
   * Forces `confirmed_at` to stay empty on a cancelled row.
   *
   * The difference matters: reinstating a cancelled registration may restore
   * `confirmed` only if the participant themselves confirmed at some point.
   */
  readonly neverConfirmed?: boolean;
}

/** Inserts registrations for one event and returns their ids, in order. */
export async function seedRegistrations(
  eventId: string,
  rows: readonly SeededRegistration[],
): Promise<readonly string[]> {
  const created: string[] = [];
  for (const row of rows) {
    const registeredAt = row.registeredAt ?? new Date().toISOString();
    // A confirmed row must carry the date — the migration's check constraint
    // enforces it, because that date is the double opt-in record.
    const confirmedAt =
      row.status === 'pending' || row.neverConfirmed ? null : registeredAt;

    const result = await pool.query<{ id: string }>(
      `INSERT INTO registration
         (event_id, email, first_name, last_name, origin, status,
          newsletter_opt_in, confirmed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz)
       RETURNING id`,
      [
        eventId,
        row.email.toLowerCase(),
        row.firstName,
        row.lastName,
        row.origin ?? null,
        row.status,
        row.newsletterOptIn ?? false,
        confirmedAt,
        registeredAt,
      ],
    );
    created.push(result.rows[0].id);
  }
  return created;
}

/**
 * Inserts `count` registrations in a single statement.
 *
 * One statement rather than a loop: the load check is about the read side, and
 * two thousand round trips would make the setup the slowest part of the suite.
 * The rows are spread one hour apart, which gives the weekly graph a realistic
 * dozen weeks to draw, and their statuses are mixed so the status filter has
 * something to do.
 */
export async function seedManyRegistrations(
  eventId: string,
  count: number,
  emailPrefix: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO registration
       (event_id, email, first_name, last_name, origin, status,
        newsletter_opt_in, confirmed_at, created_at)
     SELECT $1,
            $2 || '-' || n || '@load.example.org',
            (ARRAY['Amina', 'Bo', 'Chen', 'Dalia', 'Eze'])[1 + n % 5],
            'Load' || lpad(n::text, 5, '0'),
            (ARRAY['Cologne', 'Nairobi', 'Brussels'])[1 + n % 3],
            CASE WHEN n % 5 = 0 THEN 'cancelled'
                 WHEN n % 3 = 0 THEN 'pending'
                 ELSE 'confirmed' END,
            n % 2 = 0,
            CASE WHEN n % 5 = 0 OR n % 3 = 0 THEN NULL
                 ELSE now() - (n || ' hours')::interval END,
            now() - (n || ' hours')::interval
       FROM generate_series(1, $3) AS n`,
    [eventId, emailPrefix, count],
  );
}

/** Removes every registration of one event — the counterpart of the seeds. */
export async function deleteRegistrations(eventId: string): Promise<void> {
  await pool.query('DELETE FROM registration WHERE event_id = $1', [eventId]);
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
