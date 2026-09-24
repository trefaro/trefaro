/**
 * Fills one event with as many registrations as it takes to answer the
 * question (NFR 12, F32, AP 10 of phase 5).
 *
 * AP 5 of phase 1 measured the participant overview at **2 000** registrations
 * per event — 13 ms in the worst case, a search term matching every row — and
 * `todo.md` has kept an entry open ever since: nobody has measured an
 * organization an order of magnitude above that, and the answer at that size
 * would be `pg_trgm`, which F32 deliberately avoided because the extension
 * needs rights a managed PostgreSQL may not grant. That decision is one to
 * take in front of a real database, which is what this script makes possible.
 *
 * It writes **SQL, not API calls**, and that is the one place this tool
 * differs from `demo-seed/`. Registering goes through a double opt-in and a
 * rate limit by design (E60), so twenty thousand registrations through the API
 * would take hours and would be measuring the limiter. The rows it writes are
 * exactly the shape the API writes — same columns, same status, same
 * lower-cased address — and every one of them is recognisable and removable:
 * `--remove` deletes precisely what this wrote and nothing else.
 *
 *   EVENT_ID=… COUNT=20000 node tools/load-test/seed-registrations.mjs
 *   EVENT_ID=… node tools/load-test/seed-registrations.mjs --remove
 *
 * **Never against an instance that holds anybody's data.** It is for a
 * throwaway stack, and it says so once more before it writes.
 */
import { execFileSync } from 'node:child_process';

const POSTGRES_CONTAINER =
  process.env.POSTGRES_CONTAINER ?? 'trefaro-postgres-1';
const DATABASE_USER = process.env.DATABASE_USER ?? 'trefaro';
const DATABASE_NAME = process.env.DATABASE_NAME ?? 'trefaro';

const EVENT_ID = process.env.EVENT_ID ?? '';
const COUNT = Number(process.env.COUNT ?? '20000');

/** The mark that makes every row this wrote removable, and nothing else. */
const ADDRESS_PREFIX = 'load-test-';

/**
 * Names rather than `'person' || n`, because the search this exists to measure
 * is `ILIKE '%word%'` over three columns (F32) — and a column where every value
 * shares one prefix is a column where every term matches or none does, which
 * would make every measurement either the best case or the worst one.
 */
const FIRST_NAMES =
  "ARRAY['Amina','Jonas','Leila','Mateusz','Nour','Sofia','Tomas','Yara','Elias','Priya','Kwame','Ingrid']";
const LAST_NAMES =
  "ARRAY['Okonkwo','Schulze','Lindqvist','Haddad','Novak','Ferreira','Yilmaz','Kowalski','Mbeki','Rossi','Andersen','Nakamura','Dubois','Petrova','Singh']";

function psql(sql) {
  return execFileSync(
    'docker',
    [
      'exec',
      POSTGRES_CONTAINER,
      'psql',
      '-U',
      DATABASE_USER,
      '-d',
      DATABASE_NAME,
      '-At',
      '-c',
      sql,
    ],
    { encoding: 'utf8' },
  ).trim();
}

function countForEvent() {
  return Number(
    psql(
      `SELECT count(*) FROM registration WHERE event_id = '${EVENT_ID}'::uuid`,
    ),
  );
}

function insert() {
  // One statement, built by PostgreSQL itself: twenty thousand rows through
  // `docker exec` as literal text would be a megabyte of argument, and the
  // point of the exercise is the reading, not the writing.
  psql(`
    INSERT INTO registration (
      event_id, email, first_name, last_name, phone, origin,
      custom_fields_json, status, newsletter_opt_in, contact_opt_out,
      confirmed_at, created_at, updated_at
    )
    SELECT
      '${EVENT_ID}'::uuid,
      '${ADDRESS_PREFIX}' || n || '@example.org',
      (${FIRST_NAMES})[1 + (n % 12)],
      (${LAST_NAMES})[1 + (n % 15)],
      NULL, NULL, '{}'::jsonb,
      CASE WHEN n % 10 = 0 THEN 'pending' ELSE 'confirmed' END,
      false, false,
      CASE WHEN n % 10 = 0 THEN NULL ELSE now() - (n || ' minutes')::interval END,
      now() - (n || ' minutes')::interval,
      now()
    FROM generate_series(1, ${COUNT}) AS n
    ON CONFLICT DO NOTHING
  `);

  // Not tidiness — without this the first scenario measures the seed.
  //
  // A bulk insert leaves every tuple's visibility unproven and the planner's
  // statistics stale, so the first readers of the table pay for both: they
  // check each tuple and write the hint bits back, and twenty of them doing it
  // at once turned a 90 ms request into a 38-second one in the first run of
  // this script — while the *harder* search right afterwards stayed at 167 ms,
  // which is what gave it away. A real instance never has this debt: its rows
  // arrive one registration at a time and autovacuum has long since been
  // through. So the seed pays it here, where it belongs.
  psql('VACUUM (ANALYZE) registration');
}

function remove() {
  return Number(
    psql(`
      WITH gone AS (
        DELETE FROM registration
        WHERE event_id = '${EVENT_ID}'::uuid
          AND email LIKE '${ADDRESS_PREFIX}%@example.org'
        RETURNING 1
      )
      SELECT count(*) FROM gone
    `),
  );
}

function main() {
  if (!/^[0-9a-f-]{36}$/i.test(EVENT_ID)) {
    console.error(
      'EVENT_ID has to be the id of the event to fill — this script never ' +
        'picks one, because the one it picked would be somebody’s.',
    );
    return 1;
  }

  if (process.argv.includes('--remove')) {
    const removed = remove();
    console.log(
      `Removed ${removed} row(s) written by this script. ` +
        `${countForEvent()} registration(s) left on that event.`,
    );
    return 0;
  }

  if (!Number.isInteger(COUNT) || COUNT < 1 || COUNT > 200_000) {
    console.error(`COUNT is ${COUNT}; it has to be between 1 and 200000.`);
    return 1;
  }

  const before = countForEvent();
  console.log(
    `Event ${EVENT_ID} holds ${before} registration(s). Writing ${COUNT} more ` +
      `as ${ADDRESS_PREFIX}…@example.org — this is for a throwaway stack.`,
  );
  const started = Date.now();
  insert();
  const after = countForEvent();
  console.log(
    `${after} registration(s) now (${after - before} written) in ` +
      `${Math.round((Date.now() - started) / 1000)}s. ` +
      'Remove them again with --remove.',
  );
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`\nThe seed could not run: ${error.message}`);
  console.error(
    'POSTGRES_CONTAINER has to name this instance’s database container.',
  );
  process.exitCode = 1;
}
