/**
 * Does the participant overview need `pg_trgm`? Measured rather than argued
 * (F32, NFR 12, AP 10 of phase 5).
 *
 * F32 decided against a trigram index for a stated reason — the extension needs
 * rights a small NGO on a managed PostgreSQL may not have (NFR 15) — and backed
 * it with a measurement at 2 000 registrations per event: 13 ms for a term
 * matching every row. `todo.md` has kept the other half open ever since: an
 * organization an order of magnitude larger has never been measured, and the
 * decision has to be made in front of a real database rather than from a plan.
 *
 * This runs the query the repository actually runs — one `ILIKE '%word%'` per
 * word, OR-ed across three columns, AND-ed across words, scoped to one event,
 * ordered and paged — three times each way:
 *
 *   1. as the instance ships, which is what an operator would get today;
 *   2. with `pg_trgm` and a GIN index on each of the three columns;
 *   3. as the instance ships again, after the indexes are dropped.
 *
 * The third pass is not ceremony: it proves the database was left as it was
 * found, and it catches the case where the second pass was faster only because
 * everything was in the cache by then.
 *
 *   EVENT_ID=… node tools/load-test/trigram-measure.mjs
 *   EVENT_ID=… node tools/load-test/trigram-measure.mjs --keep
 *
 * `--keep` leaves the indexes in place, for somebody who wants to look at a
 * plan by hand. Nothing here changes the application: whatever this measures,
 * the decision it feeds belongs in `docs/PHASE5.md` and in F32.
 */
import { execFileSync } from 'node:child_process';

const POSTGRES_CONTAINER =
  process.env.POSTGRES_CONTAINER ?? 'trefaro-postgres-1';
const DATABASE_USER = process.env.DATABASE_USER ?? 'trefaro';
const DATABASE_NAME = process.env.DATABASE_NAME ?? 'trefaro';
const EVENT_ID = process.env.EVENT_ID ?? '';

/** How often each query is timed; the median of these is what gets reported. */
const RUNS = Number(process.env.TRIGRAM_RUNS ?? '5');

/**
 * The three searches that bracket the question.
 *
 * `a` is the worst case by design — F32's own measurement used a term that
 * matches every row, because that is the search where an index has the least
 * to remove and the sort has the most to do. `okonkwo` is the ordinary case,
 * one surname out of fifteen. `okonkwo amina` is two words, which is two
 * conditions on one row and the shape the docstring of `search-terms.ts`
 * argues about.
 */
const SEARCHES = ['a', 'okonkwo', 'okonkwo amina'];

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

/** The `WHERE` the repository builds for one search box (`search-terms.ts`). */
function conditionsFor(search) {
  return search
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => {
      const like = `'%${term.replace(/'/g, "''")}%'`;
      return `(registration.first_name ILIKE ${like} OR registration.last_name ILIKE ${like} OR registration.email ILIKE ${like})`;
    })
    .join(' AND ');
}

/**
 * The two statements one page of the overview costs.
 *
 * Two because `getManyAndCount` issues two, and the count is the half an index
 * helps least: a page stops after 25 rows, a count never stops early.
 */
function statementsFor(search) {
  const where = `registration.event_id = '${EVENT_ID}'::uuid AND ${conditionsFor(search)}`;
  return [
    {
      what: 'page',
      sql: `SELECT registration.* FROM registration registration WHERE ${where} ORDER BY registration.created_at DESC, registration.id ASC LIMIT 25 OFFSET 0`,
    },
    {
      what: 'count',
      sql: `SELECT count(*) FROM registration registration WHERE ${where}`,
    },
  ];
}

/** Milliseconds `EXPLAIN ANALYZE` reports for the statement itself. */
function timeOnce(sql) {
  const output = psql(`EXPLAIN (ANALYZE, TIMING OFF, SUMMARY ON) ${sql}`);
  const match = /Execution Time: ([0-9.]+) ms/.exec(output);
  if (!match) throw new Error(`No execution time in:\n${output}`);
  return Number(match[1]);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length / 2)] * 100) / 100;
}

function measure() {
  const rows = [];
  for (const search of SEARCHES) {
    for (const { what, sql } of statementsFor(search)) {
      const times = Array.from({ length: RUNS }, () => timeOnce(sql));
      rows.push({ search, what, ms: median(times) });
    }
  }
  return rows;
}

function print(title, rows) {
  console.log(`\n${title}`);
  for (const { search, what, ms } of rows) {
    console.log(`  "${search}" ${what.padEnd(5)} ${ms} ms`);
  }
}

function addTrigramIndexes() {
  psql('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  for (const column of ['first_name', 'last_name', 'email']) {
    psql(
      `CREATE INDEX IF NOT EXISTS trgm_registration_${column} ` +
        `ON registration USING gin (${column} gin_trgm_ops)`,
    );
  }
  psql('ANALYZE registration');
}

function dropTrigramIndexes() {
  for (const column of ['first_name', 'last_name', 'email']) {
    psql(`DROP INDEX IF EXISTS trgm_registration_${column}`);
  }
  // The extension stays: dropping it is a privileged act with nothing to gain,
  // and an instance that already had it should still have it afterwards.
  psql('ANALYZE registration');
}

function main() {
  if (!/^[0-9a-f-]{36}$/i.test(EVENT_ID)) {
    console.error('EVENT_ID has to be the id of the event to measure.');
    return 1;
  }

  const total = Number(
    psql(
      `SELECT count(*) FROM registration WHERE event_id = '${EVENT_ID}'::uuid`,
    ),
  );
  console.log(
    `Measuring the participant overview of event ${EVENT_ID}\n` +
      `${total} registration(s) on it, ${RUNS} runs per statement, median reported\n` +
      `${new Date().toISOString()} — PostgreSQL ${psql('SHOW server_version')}`,
  );

  const before = measure();
  print('As the instance ships (no pg_trgm, F32)', before);

  addTrigramIndexes();
  const withTrigrams = measure();
  print(
    'With pg_trgm and a GIN index on each of the three columns',
    withTrigrams,
  );

  if (process.argv.includes('--keep')) {
    console.log('\nThe indexes were left in place (--keep).');
  } else {
    dropTrigramIndexes();
    print('As the instance ships, again — indexes dropped', measure());
  }

  console.log(
    '\nWhat this does not decide: whether an instance may create the ' +
      'extension at all. That is the argument F32 rests on (NFR 15), and no ' +
      'measurement here can answer it.',
  );
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`\nThe measurement could not run: ${error.message}`);
  process.exitCode = 1;
}
