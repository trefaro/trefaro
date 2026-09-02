import { request } from '@playwright/test';
import { Pool } from 'pg';
import { ADMIN_STORAGE_STATE, SERIES_SLUG_PREFIX } from './admin-session';

/**
 * Registrations for the participant overview to show.
 *
 * Written straight into the database, and that is a deliberate exception to the
 * rule that fixtures go through the API:
 *
 * - The public registration endpoint sends a mail per attempt and is rate
 *   limited on purpose (AP 4). Three browser engines seeding thirty rows each
 *   would spend the whole budget and a hundred mails on a fixture.
 * - The states this suite needs cannot all be produced from outside. A confirmed
 *   registration requires following a mailed link, and a cancelled one that was
 *   never confirmed cannot be reached through the organizer API either — by
 *   design (E5, F23).
 *
 * That the double opt-in actually produces such rows is asserted elsewhere: in
 * `apps/server-e2e` and in the participant client's own suite, both against
 * Mailpit. Here the subject under test is the table, and the fixture is its
 * content.
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4300';

/**
 * Opened on demand, and re-openable.
 *
 * Two specs use these fixtures, and Playwright may put both in one worker
 * process — where each closes the pool when it is done. A module-level pool
 * would leave the second spec seeding against a closed one, which fails in the
 * fixture rather than in a test and is correspondingly hard to read.
 */
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

/**
 * How many anonymous rows sit behind the named ones — enough for a second page.
 *
 * They are older than every named participant, so the default order (newest
 * first) puts the four the tests act on on the first page. A fixture whose
 * interesting rows are on page two would make every locator here depend on the
 * page size.
 */
export const FILLER_ROWS = 24;

/** How much older the filler is than the oldest named participant, in days. */
const FILLER_OFFSET_DAYS = 30;

/** Named participants the tests search, sort and act on. */
export const PARTICIPANTS = [
  {
    firstName: 'Amina',
    lastName: 'Okonkwo',
    status: 'confirmed',
    origin: 'Cologne',
    daysAgo: 21,
  },
  {
    firstName: 'Bruno',
    lastName: 'Adeyemi',
    status: 'pending',
    origin: 'Brussels',
    daysAgo: 14,
  },
  {
    firstName: 'Chiara',
    lastName: 'Okonkwo',
    status: 'cancelled',
    origin: 'Milan',
    daysAgo: 7,
    neverConfirmed: true,
  },
  {
    firstName: 'Dieter',
    lastName: 'Zimmermann',
    status: 'confirmed',
    origin: 'Leipzig',
    daysAgo: 3,
  },
] as const;

export interface SeededEvent {
  readonly seriesId: string;
  readonly seriesSlug: string;
  readonly eventId: string;
  readonly eventSlug: string;
  /** Distinctive, so a locator for the event's row cannot match a link named after the page. */
  readonly eventName: string;
  /**
   * The one address of this fixture that also has a participant account.
   *
   * For the profile column (FR 3.3, AP 4): the table says whether an address
   * can log in, and only a row of `user_profile` can make that true.
   */
  readonly accountEmail: string;
}

interface Created {
  id: string;
  slug: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Creates a published series with one event and fills it with registrations.
 *
 * The series and event go through the administrative API — the same path an
 * organizer takes — and carry the suite's slug prefix, so the global teardown
 * removes them even after a failed run.
 */
export async function seedParticipants(label: string): Promise<SeededEvent> {
  const context = await request.newContext({
    baseURL: CLIENT_URL,
    storageState: ADMIN_STORAGE_STATE,
  });

  try {
    const series: Created = await (
      await context.post('/api/admin/series', {
        data: {
          name: `${SERIES_SLUG_PREFIX}participants ${label}`,
          description: 'Holds the event whose participants the suite reads.',
          status: 'published',
        },
      })
    ).json();

    const eventName = `Overview Event ${label}`;
    const event: Created = await (
      await context.post(`/api/admin/series/${series.id}/events`, {
        data: {
          name: eventName,
          description: 'The event whose registrations the overview shows.',
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

    await insertRegistrations(event.id, label);
    const accountEmail = addressOf(PARTICIPANTS[0], label);
    await insertAccount(accountEmail);

    return {
      seriesId: series.id,
      seriesSlug: series.slug,
      eventId: event.id,
      eventSlug: event.slug,
      eventName,
      accountEmail,
    };
  } finally {
    await context.dispose();
  }
}

/** Removes the registrations, then the series that held them (E14). */
export async function removeParticipants(seeded: SeededEvent): Promise<void> {
  await db().query('DELETE FROM registration WHERE event_id = $1', [
    seeded.eventId,
  ]);
  // The account is instance-wide (E31), so it has to go by address rather than
  // with the event — a leftover would mark somebody else's row in the next run.
  await db().query('DELETE FROM user_profile WHERE lower(email) = lower($1)', [
    seeded.accountEmail,
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

export async function closeFixtureDatabase(): Promise<void> {
  const open = pool;
  pool = null;
  await open?.end();
}

/** The address one of the named participants registered with. */
function addressOf(
  person: { readonly firstName: string; readonly lastName: string },
  label: string,
): string {
  return `${person.firstName}.${person.lastName}.${label}@participants.example.org`.toLowerCase();
}

/**
 * A confirmed participant account for one of the seeded addresses.
 *
 * By SQL, like the registrations and for a sharper version of the same reason:
 * a real account costs a registration, a mail and a confirmation, and nobody
 * logs into this one. The password hash is a placeholder on purpose — the
 * column is `NOT NULL`, and a value that cannot verify is the honest way to say
 * that this fixture is not a credential.
 *
 * `confirmed_at` is set, because that is what the column claims: an account
 * whose double opt-in is outstanding is not a profile yet (E32).
 */
async function insertAccount(email: string): Promise<void> {
  await db().query(
    `INSERT INTO user_profile
       (email, password_hash, first_name, last_name, preferred_locale,
        confirmed_at)
     VALUES ($1, 'not-a-usable-hash', 'Amina', 'Okonkwo', 'en', now())
     ON CONFLICT DO NOTHING`,
    [email],
  );
}

async function insertRegistrations(
  eventId: string,
  label: string,
): Promise<void> {
  for (const [index, person] of PARTICIPANTS.entries()) {
    const registeredAt = new Date(
      Date.now() - person.daysAgo * DAY_MS,
    ).toISOString();
    await db().query(
      `INSERT INTO registration
         (event_id, email, first_name, last_name, phone, origin, status,
          newsletter_opt_in, confirmed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::timestamptz)`,
      [
        eventId,
        `${person.firstName}.${person.lastName}.${label}@participants.example.org`.toLowerCase(),
        person.firstName,
        person.lastName,
        index === 0 ? '+49 221 123456' : null,
        person.origin,
        person.status,
        index === 0,
        // A confirmed row must carry the date, and a cancelled one that was
        // never confirmed must not — the check constraint enforces the first,
        // and reinstating depends on the second.
        person.status === 'pending' ||
        ('neverConfirmed' in person && person.neverConfirmed)
          ? null
          : registeredAt,
        registeredAt,
      ],
    );
  }

  // Filler, so the table has a second page to turn to.
  await db().query(
    `INSERT INTO registration
       (event_id, email, first_name, last_name, status, newsletter_opt_in,
        confirmed_at, created_at)
     SELECT $1,
            'filler-' || n || '-' || $2 || '@participants.example.org',
            'Filler',
            'Person' || lpad(n::text, 3, '0'),
            'pending',
            false,
            NULL,
            now() - ((n + $4) || ' days')::interval
       FROM generate_series(1, $3) AS n`,
    [eventId, label.toLowerCase(), FILLER_ROWS, FILLER_OFFSET_DAYS],
  );
}
