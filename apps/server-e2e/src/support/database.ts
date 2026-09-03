import { createHash, randomBytes } from 'node:crypto';
import { Pool } from 'pg';

/**
 * Direct database access for the API contract tests.
 *
 * Used almost only for one thing: putting registrations into the table in bulk. The
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

/**
 * Inserts `count` confirmed registrations in a single statement.
 *
 * Separate from {@link seedManyRegistrations}, whose statuses are mixed on
 * purpose: the volume check of the invitations (FR 2.4) needs a known number of
 * addresses that may actually be written to, and "roughly half of four hundred"
 * would make the assertion about the send a guess.
 */
export async function seedManyConfirmedRegistrations(
  eventId: string,
  count: number,
  emailPrefix: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO registration
       (event_id, email, first_name, last_name, status, confirmed_at, created_at)
     SELECT $1,
            $2 || '-' || n || '@load.example.org',
            'Invitee' || n,
            'Load' || lpad(n::text, 5, '0'),
            'confirmed',
            now() - (n || ' minutes')::interval,
            now() - (n || ' minutes')::interval
       FROM generate_series(1, $3) AS n`,
    [eventId, emailPrefix, count],
  );
}

/**
 * Claims seats in a session directly (FR 3.10).
 *
 * The same deliberate exception as the registrations above: the real way to a
 * seat is a link the server mailed after a double opt-in, and that whole path is
 * walked in `program-signups.spec.ts`. A suite that only needs a session to be
 * two-thirds full should not have to send six mails to get there — and every
 * constraint of the table still applies, so a state the real flow could not
 * produce fails here too.
 */
export async function seedProgramSignups(
  programItemId: string,
  registrationIds: readonly string[],
): Promise<void> {
  for (const registrationId of registrationIds) {
    await pool.query(
      `INSERT INTO program_item_signup (program_item_id, registration_id)
       VALUES ($1, $2)`,
      [programItemId, registrationId],
    );
  }
}

/**
 * Switches an optional core module on or off (FR 1.5).
 *
 * Straight into `module_config`, because that is the only switch there is until
 * phase 2 builds the module administration — and it is also how an operator does
 * it today, which makes it the honest thing to test against. The server re-reads
 * the flags on a timer, so a caller has to wait for the change to take effect
 * rather than expecting the next request to see it.
 */
export async function setModuleEnabled(
  moduleKey: string,
  enabled: boolean,
): Promise<void> {
  await pool.query(
    'UPDATE module_config SET enabled = $2 WHERE module_key = $1',
    [moduleKey, enabled],
  );
}

/**
 * The two stored branding paths (E19).
 *
 * The one read in this file, and the reason it is here rather than derived from
 * an endpoint: the point of the branding contract is that the stored path is
 * *not* in any answer the API gives. A test that wants to prove the path is
 * unreachable has to learn it from the only place that holds it.
 */
export async function brandingPaths(): Promise<{
  logoPath: string | null;
  appIconPath: string | null;
}> {
  const result = await pool.query<{
    logo_path: string | null;
    app_icon_path: string | null;
  }>('SELECT logo_path, app_icon_path FROM app_config WHERE id = 1');

  return {
    logoPath: result.rows[0]?.logo_path ?? null,
    appIconPath: result.rows[0]?.app_icon_path ?? null,
  };
}

/** Removes every registration of one event — the counterpart of the seeds. */
export async function deleteRegistrations(eventId: string): Promise<void> {
  await pool.query('DELETE FROM registration WHERE event_id = $1', [eventId]);
}

/**
 * A participant account, put into the table directly (FR 4.1, FR 4.4).
 *
 * The deliberate exception the other seeds also claim, and here it is not only
 * about cost: two of the states the participant search has to be held to
 * **cannot** be produced through the API at all. `searchable` is only writable
 * behind a session (`PATCH /api/participant/me`), and a session only exists
 * after the address has confirmed itself (E32) — so "opted in but never
 * confirmed" has no path through the endpoints, and that is precisely the row
 * that must not appear in a directory.
 *
 * The password hash is nonsense on purpose: these fixtures are looked **for**,
 * never logged in as, and a suite that could log in as them would be spending
 * the participant login budget on rows it never reads (E4).
 */
export interface SeededProfile {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly activityAreas?: string | null;
  /** Defaults to `false`, exactly like the column (E37, F13). */
  readonly searchable?: boolean;
  /** Defaults to confirmed; `false` leaves the double opt-in outstanding. */
  readonly confirmed?: boolean;
  readonly customFields?: Readonly<Record<string, string | boolean>>;
  readonly preferredLocale?: string;
}

/** Inserts one profile and returns its id. */
export async function seedProfile(profile: SeededProfile): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO user_profile
       (email, password_hash, first_name, last_name, preferred_locale,
        activity_areas, custom_fields_json, searchable, confirmed_at)
     VALUES ($1, 'not-a-usable-hash', $2, $3, $4, $5, $6::jsonb, $7,
             CASE WHEN $8 THEN now() ELSE NULL END)
     RETURNING id`,
    [
      profile.email.toLowerCase(),
      profile.firstName,
      profile.lastName,
      profile.preferredLocale ?? 'en',
      profile.activityAreas ?? null,
      JSON.stringify(profile.customFields ?? {}),
      profile.searchable ?? false,
      profile.confirmed ?? true,
    ],
  );
  return result.rows[0].id;
}

/**
 * Removes the participant accounts a suite created (FR 4.1).
 *
 * There is no endpoint for this, and deliberately so: deleting one's own
 * account is erasure work for phase 5, and an organizer cannot delete a
 * participant's account at all. The suite still has to clean up after itself,
 * because the address is unique instance-wide (E31) — a leftover row would make
 * the next run of this file register an address that already exists and assert
 * the wrong branch. Sessions go with it through the cascade.
 */
export async function deleteProfiles(emailSuffix: string): Promise<void> {
  await pool.query('DELETE FROM user_profile WHERE email LIKE $1', [
    `%${emailSuffix}`,
  ]);
}

/**
 * Removes the profile questions a suite defined (FR 4.3, E35).
 *
 * The field kit is instance-wide, which is what makes this necessary rather
 * than tidy: a **required** question left behind would make every other suite's
 * profile update fail, and a leftover key would make the next run of the
 * defining suite take the "numbered around a collision" branch instead of the
 * one it asserts. There is an endpoint for this — but only for an organizer,
 * and only one id at a time; the prefix is what makes the cleanup complete.
 */
export async function deleteProfileFields(keyPrefix: string): Promise<void> {
  await pool.query('DELETE FROM profile_field WHERE key LIKE $1', [
    `${keyPrefix}%`,
  ]);
}

/**
 * Removes the conversations a suite created, and the pictures in them (E40).
 *
 * There is no endpoint for this, and there is no cascade either:
 * `conversation_member.member_id` carries no foreign key on purpose (E39), so
 * deleting the accounts leaves the conversations standing. The rows have to go
 * all the same — a unique `direct_key` and a growing `messages/` subtree are
 * both instance-wide.
 *
 * The order is the interesting part, and it is the order the real purge of AP
 * 10 will need: **read the attachment ids, delete the conversations, then
 * delete the attachments.** Deleting an attachment first does not work, and
 * the reason is a pair of constraints meeting: `message.attachment_id` is
 * `ON DELETE SET NULL`, so a removed file leaves the message standing (E40) —
 * but a message that is a picture **alone** would then have neither text nor
 * picture, which `CHK_message_content` forbids. Together the two say something
 * sensible: you may take the file off a message that also has words, and you
 * may not empty a message out. Whoever wants the file gone deletes the message.
 *
 * The **files** stay in the volume either way: SQL cannot unlink one, which is
 * the same limitation the migration's `down` has.
 */
export async function deleteConversations(
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;

  const pictures = await pool.query<{ attachment_id: string }>(
    `SELECT attachment_id FROM message
      WHERE conversation_id = ANY($1::uuid[]) AND attachment_id IS NOT NULL`,
    [ids],
  );

  // Cascades through `message`, which is what frees the attachment rows.
  await pool.query('DELETE FROM conversation WHERE id = ANY($1::uuid[])', [
    ids,
  ]);

  const attachments = pictures.rows.map((row) => row.attachment_id);
  if (attachments.length > 0) {
    await pool.query('DELETE FROM attachment WHERE id = ANY($1::uuid[])', [
      attachments,
    ]);
  }
}

/**
 * One line of a contact request, as it was stored (FR 3.4, AP 9).
 *
 * Read from the database and not from an endpoint, because until AP 10 there
 * is none: the organizer's message overview is that package. What can be
 * asserted today is the shape the overview will read — which is also what E39
 * decided, so it is worth holding on to now rather than later.
 */
export interface StoredContactRequest {
  readonly conversationId: string;
  readonly type: string;
  readonly eventId: string | null;
  readonly topic: string | null;
  readonly guestEmail: string | null;
  readonly guestName: string | null;
  readonly lastMessageAt: Date | null;
  readonly senderType: string | null;
  readonly senderId: string | null;
  readonly body: string | null;
  /** How many members the conversation has — none, for a contact request. */
  readonly members: number;
}

/** Every contact request of one address, newest first, with its first line. */
export async function contactRequestsOf(
  guestEmail: string,
): Promise<readonly StoredContactRequest[]> {
  const result = await pool.query<StoredContactRequest>(
    `SELECT c."id"              AS "conversationId",
            c."type"            AS "type",
            c."event_id"        AS "eventId",
            c."topic"           AS "topic",
            c."guest_email"     AS "guestEmail",
            c."guest_name"      AS "guestName",
            c."last_message_at" AS "lastMessageAt",
            m."sender_type"     AS "senderType",
            m."sender_id"       AS "senderId",
            m."body"            AS "body",
            (SELECT COUNT(*)::int FROM "conversation_member" cm
              WHERE cm."conversation_id" = c."id") AS "members"
       FROM "conversation" c
       LEFT JOIN "message" m ON m."conversation_id" = c."id"
      WHERE c."guest_email" = $1
      ORDER BY c."created_at" DESC, m."created_at" ASC`,
    [guestEmail.toLowerCase()],
  );
  return result.rows;
}

/**
 * A live participant session for a seeded account, without a login (E34, E4).
 *
 * The login budget is twenty attempts per five minutes for the whole instance
 * and the account suites already use sixteen, so a suite that needs a session
 * and nothing else about logging in does not spend one. What a session *is* is
 * a row whose `token_hash` is the SHA-256 of the value in the cookie — the
 * handshake and the guard both resolve it that way and neither can tell how
 * the row got there.
 *
 * Written rather than asked for, and worth the exception for the same reason
 * `seedProfile` is: the real-time suite needs **two** sessions to prove that a
 * message reaches both sides, and two logins would take the instance to
 * eighteen of twenty — where the next suite anybody writes turns green tests
 * into a 429 that reads like a broken login.
 *
 * @returns the cookie value, ready to be sent as `trefaro_user_session=…`.
 */
export async function seedSession(profileId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 12 * 60 * 60_000);

  await pool.query(
    `INSERT INTO user_session (user_id, token_hash, last_seen_at, expires_at)
     VALUES ($1, $2, now(), $3)`,
    [profileId, createHash('sha256').update(token).digest('hex'), expiresAt],
  );

  return token;
}

/**
 * The `attachment` row behind one message's picture (E40).
 *
 * There is no endpoint that hands out this id, and that is the point: the
 * picture is addressed by the **message**, so a member never learns which file
 * it is. The chat suite needs it to prove the other half of the rule — that
 * `GET /api/admin/attachments/:id` answers 404 for it, because the organizer's
 * download route serves the files a registration collected and nothing else.
 */
export async function messageAttachmentId(
  messageId: string,
): Promise<string | null> {
  const result = await pool.query<{ attachment_id: string | null }>(
    'SELECT attachment_id FROM message WHERE id = $1',
    [messageId],
  );
  return result.rows[0]?.attachment_id ?? null;
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
