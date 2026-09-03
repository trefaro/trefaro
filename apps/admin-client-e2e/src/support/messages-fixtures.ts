import { request } from '@playwright/test';
import { Pool } from 'pg';
import { ADMIN_STORAGE_STATE, SERIES_SLUG_PREFIX } from './admin-session';

/**
 * A question from somebody without an account, and three people who could be
 * put into a group (FR 3.4, E39) — AP 10.
 *
 * Two halves, seeded two ways, and the difference is deliberate:
 *
 * - **The question goes through its own endpoint.** It is public and
 *   unauthenticated, one request, no mail to a stranger (F172) — so there is
 *   no reason to fake what the application does anyway.
 * - **The registrations and the accounts are written by SQL**, the exception
 *   the participant fixtures already claim: a confirmed registration means
 *   following a mailed link, and an account means a second one. Three engines
 *   doing that for three people each would spend the whole registration budget
 *   on a fixture (E4). That the double opt-in really produces such rows is
 *   asserted in `apps/server-e2e` and in the participant client's suite, both
 *   against Mailpit.
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4300';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Who can be put into a group: confirmed, with an account. */
export const MEMBERS = [
  { firstName: 'Amina', lastName: 'Okonkwo' },
  { firstName: 'Bo', lastName: 'Lindgren' },
  { firstName: 'Chen', lastName: 'Wei' },
] as const;

/** Confirmed, but without an account — offered to nobody (E39). */
export const WITHOUT_ACCOUNT = {
  firstName: 'Dalia',
  lastName: 'Haddad',
} as const;

export const GUEST = {
  /**
   * The name is per engine, and that is not cosmetic.
   *
   * Three engines run this spec against one instance, so three rows of the
   * overview would carry the same name — and a locator for "the row of the
   * person who asked" would match all three. The address already differs; the
   * name has to as well, because that is what the row is *called*.
   */
  name: (label: string) => `Fatou Diallo ${label}`,
  question:
    'is the venue accessible by wheelchair? I would come with my mother.',
} as const;

export interface SeededMessages {
  readonly seriesId: string;
  readonly seriesName: string;
  readonly eventId: string;
  readonly eventName: string;
  /** The address the answer will go to — shown on the screen and in the mail. */
  readonly guestEmail: string;
  readonly guestName: string;
  /** Everything created for this label, for the teardown to find again. */
  readonly label: string;
}

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

export const addressOf = (
  person: { readonly firstName: string; readonly lastName: string },
  label: string,
): string =>
  `${person.firstName}.${person.lastName}.${label}@messages.example.org`.toLowerCase();

export async function seedMessages(label: string): Promise<SeededMessages> {
  const context = await request.newContext({
    baseURL: CLIENT_URL,
    storageState: ADMIN_STORAGE_STATE,
  });

  try {
    const seriesName = `${SERIES_SLUG_PREFIX}messages ${label}`;
    const series: { id: string; slug: string } = await (
      await context.post('/api/admin/series', {
        data: {
          name: seriesName,
          description: 'Holds the event these conversations are about.',
          status: 'published',
          // Where a question about this series lands (F172). Its own address
          // per engine, so three runs do not read each other's mail.
          contactEmail: `organizers.${label}@messages.example.org`,
        },
      })
    ).json();

    const eventName = `Messages Event ${label}`;
    const event: { id: string; slug: string } = await (
      await context.post(`/api/admin/series/${series.id}/events`, {
        data: {
          name: eventName,
          description: 'The event the question is about.',
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

    for (const person of MEMBERS) {
      await insertRegistration(event.id, person, label, 'confirmed');
      await insertAccount(person, label);
    }
    await insertRegistration(event.id, WITHOUT_ACCOUNT, label, 'confirmed');

    const guestEmail = `guest.${label}@messages.example.org`;
    const guestName = GUEST.name(label);
    // The public form itself: no account, no login, always 202 (E10).
    await context.post(
      `/api/user/series/${series.slug}/events/${event.slug}/contact`,
      { data: { name: guestName, email: guestEmail, body: GUEST.question } },
    );

    return {
      seriesId: series.id,
      seriesName,
      eventId: event.id,
      eventName,
      guestEmail,
      guestName,
      label,
    };
  } finally {
    await context.dispose();
  }
}

/**
 * Removes everything one label created, conversations first.
 *
 * The order is the one F158 spells out: the conversations, then the pictures
 * they held — and only then the series, whose cascade would otherwise leave
 * `attachment` rows nothing points at. This fixture sends no pictures, so the
 * second step is a precaution rather than a need; the order is written down
 * because getting it wrong fails silently.
 */
export async function removeMessages(seeded: SeededMessages): Promise<void> {
  await db().query(
    `DELETE FROM conversation
      WHERE event_id = $1
         OR guest_email = $2`,
    [seeded.eventId, seeded.guestEmail],
  );
  await db().query('DELETE FROM registration WHERE event_id = $1', [
    seeded.eventId,
  ]);
  // Accounts are instance-wide (E31), so they go by address.
  await db().query('DELETE FROM user_profile WHERE email LIKE $1', [
    `%.${seeded.label}@messages.example.org`,
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

export async function closeMessagesDatabase(): Promise<void> {
  const open = pool;
  pool = null;
  await open?.end();
}

async function insertRegistration(
  eventId: string,
  person: { readonly firstName: string; readonly lastName: string },
  label: string,
  status: 'confirmed' | 'pending',
): Promise<void> {
  // The date is decided here rather than in a `CASE` over the parameter:
  // PostgreSQL deduces one type per placeholder, and the same `$5` used as the
  // value of a `varchar(16)` column and compared against a text literal is
  // "inconsistent types deduced for parameter $5".
  const confirmedAt = status === 'confirmed' ? new Date().toISOString() : null;

  await db().query(
    `INSERT INTO registration
       (event_id, email, first_name, last_name, status, newsletter_opt_in,
        confirmed_at, created_at)
     VALUES ($1, $2, $3, $4, $5, false, $6::timestamptz, now())`,
    [
      eventId,
      addressOf(person, label),
      person.firstName,
      person.lastName,
      status,
      confirmedAt,
    ],
  );
}

/**
 * A confirmed participant account for one of the seeded addresses.
 *
 * The password hash is a placeholder: nobody logs into these, and a value that
 * cannot verify is the honest way to say that this fixture is not a credential.
 */
async function insertAccount(
  person: { readonly firstName: string; readonly lastName: string },
  label: string,
): Promise<void> {
  await db().query(
    `INSERT INTO user_profile
       (email, password_hash, first_name, last_name, preferred_locale,
        confirmed_at)
     VALUES ($1, 'not-a-usable-hash', $2, $3, 'en', now())
     ON CONFLICT DO NOTHING`,
    [addressOf(person, label), person.firstName, person.lastName],
  );
}
