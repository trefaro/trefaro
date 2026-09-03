import { createHash, randomBytes } from 'node:crypto';
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

/**
 * A live participant session for a seeded account, without a login (E34, E4,
 * F164).
 *
 * The participant login allows twenty attempts per five minutes for the whole
 * instance and the suites of this repository already use nineteen of them, so
 * a file that needs a **session** and nothing about logging in does not spend
 * one — the browser gets the cookie handed to it instead
 * (`support/participant-session.ts` puts it there). What a session *is* is a
 * row whose `token_hash` is the SHA-256 of the cookie's value; the guard and
 * the socket handshake both resolve it that way and neither can tell how the
 * row got there.
 *
 * What this gives up is the proof that a login issues a cookie the client can
 * use — and that proof is already run, twice: `profile.spec.ts` signs in
 * through the form, and the API suites do it against the same guard chain.
 *
 * @returns the cookie value, ready to be sent as `trefaro_user_session=…`.
 */
export async function seedSession(profileId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 12 * 60 * 60_000);

  await db().query(
    `INSERT INTO user_session (user_id, token_hash, last_seen_at, expires_at)
     VALUES ($1, $2, now(), $3)`,
    [profileId, createHash('sha256').update(token).digest('hex'), expiresAt],
  );

  return token;
}

/**
 * Removes the conversations of the accounts of one address domain, and the
 * pictures in them (E40, F158).
 *
 * There is no endpoint and there is no cascade either:
 * `conversation_member.member_id` carries no foreign key on purpose (E39), so
 * deleting the accounts would leave the conversations standing — with a unique
 * `direct_key` that would refuse the next run, and a growing `messages/`
 * subtree.
 *
 * The order is the part worth knowing, and it is the order the real purge of
 * AP 10 will need: **read the attachment ids, delete the conversations, then
 * delete the attachments.** The other way round does not work, because
 * `message.attachment_id` is `ON DELETE SET NULL` while
 * `CHK_message_content` forbids a message with neither text nor picture — so
 * a picture-only message cannot be emptied, only deleted. The **files** stay
 * in the volume either way: SQL cannot unlink one.
 *
 * Called before {@link deleteProfiles}, never after: the members are found
 * through the profiles.
 */
export async function deleteConversationsOfProfiles(
  emailSuffix: string,
): Promise<void> {
  const conversations = await db().query<{ conversation_id: string }>(
    `SELECT DISTINCT m.conversation_id
       FROM conversation_member m
       JOIN user_profile p ON p.id = m.member_id
      WHERE m.member_type = 'user' AND p.email LIKE $1`,
    [`%${emailSuffix}`],
  );
  const ids = conversations.rows.map((row) => row.conversation_id);
  if (ids.length === 0) return;

  const pictures = await db().query<{ attachment_id: string }>(
    `SELECT attachment_id FROM message
      WHERE conversation_id = ANY($1::uuid[]) AND attachment_id IS NOT NULL`,
    [ids],
  );

  // Cascades through `message`, which is what frees the attachment rows.
  await db().query('DELETE FROM conversation WHERE id = ANY($1::uuid[])', [
    ids,
  ]);

  const attachments = pictures.rows.map((row) => row.attachment_id);
  if (attachments.length > 0) {
    await db().query('DELETE FROM attachment WHERE id = ANY($1::uuid[])', [
      attachments,
    ]);
  }
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
