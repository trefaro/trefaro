import { Pool } from 'pg';

/**
 * A confirmed registration, written straight into the database.
 *
 * A deliberate exception to this suite's rule that fixtures go through the real
 * flow, and it is the same exception the organizer suite makes for the same
 * reason: the public registration endpoint sends a mail per attempt and allows
 * sixty attempts per five minutes and client address (E4). In CI all three e2e
 * projects run against one server, so those sixty are shared — and a suite that
 * spends six of them on a fixture makes an unrelated spec fail with a 429.
 *
 * What is *not* faked is the part under test. The invitation suite needs a
 * confirmed registration to exist; that the double opt-in produces one is
 * proven in `registration.spec.ts`, in `my-registration.spec.ts` and in the API
 * contract suite, all three against Mailpit. Every constraint of the table still
 * applies here, so a state the real flow could not reach fails here too.
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

export interface SeededPerson {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
}

/** Inserts one confirmed registration and returns its id. */
export async function seedConfirmedRegistration(
  eventId: string,
  person: SeededPerson,
): Promise<string> {
  const result = await db().query<{ id: string }>(
    `INSERT INTO registration
       (event_id, email, first_name, last_name, status, confirmed_at, created_at)
     VALUES ($1, $2, $3, $4, 'confirmed', now(), now())
     RETURNING id`,
    [eventId, person.email.toLowerCase(), person.firstName, person.lastName],
  );
  return result.rows[0].id;
}

/**
 * Removes the participant accounts a run created (FR 4.1, E31).
 *
 * By SQL, because there is no endpoint for it: an organizer cannot delete
 * somebody's account, and by design — "archiving is the rule, deleting the
 * exception". A test account is the exception, and it has to go, because the
 * address is unique across the instance (E31): a leftover would make the next
 * run's registration take the "there is already an account" branch and wait for
 * a mail that says something else.
 *
 * Deleted rather than anonymized: the sessions and the avatar path hang off the
 * row by foreign key, so the row is what has to go.
 */
/**
 * A confirmed participant account that has opted into the search (FR 4.4).
 *
 * Somebody for the search to find, and the same exception as the registration
 * above: this row is looked **for**, never logged in as. Doing it through the
 * endpoints would cost a registration, a confirmation mail and a login out of
 * budgets three e2e projects share (E4) — and `searchable` cannot be set
 * without a session at all, so the fixture could not be built that way in one
 * pass anyway.
 *
 * The password hash is nonsense on purpose: nothing may sign in as this row.
 */
export async function seedSearchableProfile(person: {
  email: string;
  firstName: string;
  lastName: string;
  activityAreas: string;
}): Promise<string> {
  const result = await db().query<{ id: string }>(
    `INSERT INTO user_profile
       (email, password_hash, first_name, last_name, preferred_locale,
        activity_areas, searchable, confirmed_at)
     VALUES ($1, 'not-a-usable-hash', $2, $3, 'en', $4, true, now())
     RETURNING id`,
    [
      person.email.toLowerCase(),
      person.firstName,
      person.lastName,
      person.activityAreas,
    ],
  );
  return result.rows[0].id;
}

export async function deleteProfiles(emailSuffix: string): Promise<void> {
  await db().query('DELETE FROM user_profile WHERE email LIKE $1', [
    `%${emailSuffix}`,
  ]);
}

/**
 * Closes the pool again, re-openably.
 *
 * A worker that seeds after the close reopens it: Playwright may put two specs
 * in one worker process, and a closed module-level pool would fail in the
 * fixture rather than in a test.
 */
export async function closeSeedDatabase(): Promise<void> {
  const open = pool;
  pool = null;
  await open?.end();
}
