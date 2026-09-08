import { Pool, type PoolClient } from 'pg';

/**
 * One lock for every browser suite that switches a module **another suite
 * switches too** — AP 5 of phase 4.
 *
 * `module_config` belongs to the whole instance, and Playwright runs the files
 * of one suite on eight workers locally (`docs/rules/e2e-tests.md`). Until AP 5
 * every file flipped a flag of its own, so "restore what you found" was enough.
 * The forum's organizer suite is the first that needs a **second** plug-in on
 * — the acceptance criterion of the package is two plug-in tiles side by side
 * on one dashboard — and the proposals suite switches that same flag off in
 * its last test. Two files, one flag, two workers: whichever assertion ran
 * during the other's window was red, and "restore what you found" would have
 * put back whatever the other file had just set.
 *
 * The lock is PostgreSQL's own: a session-level advisory lock, held on a
 * connection of its own from `beforeAll` to `afterAll`. Both files take it
 * before they read the flags and release it after they have restored them, so
 * the two run one after the other and "what was found" is the resting state.
 * Session-level rather than transaction-level, because it has to outlive every
 * statement in between; and a worker that crashes drops its connection, which
 * releases the lock — no lock file to clean up after a failed run.
 *
 * Waiting for the lock counts against the hook's timeout, so a hook that takes
 * it raises its own timeout first (`test.setTimeout`).
 */
const KEY = [0x74726566, 1] as const; // "tref", and 1 for module switches

let pool: Pool | null = null;
let holder: PoolClient | null = null;

function db(): Pool {
  pool ??= new Pool({
    host: process.env['DATABASE_HOST'] ?? 'localhost',
    port: Number(process.env['DATABASE_PORT'] ?? 5432),
    user: process.env['DATABASE_USER'] ?? 'trefaro',
    password: process.env['DATABASE_PASSWORD'] ?? 'trefaro_dev',
    database: process.env['DATABASE_NAME'] ?? 'trefaro',
    max: 1,
  });
  return pool;
}

/** Blocks until no other suite holds the lock, then holds it. */
export async function lockModuleSwitches(): Promise<void> {
  if (holder) return;
  holder = await db().connect();
  await holder.query('SELECT pg_advisory_lock($1, $2)', [...KEY]);
}

/** Releases the lock and the connection it lives on. */
export async function unlockModuleSwitches(): Promise<void> {
  if (!holder) return;
  try {
    await holder.query('SELECT pg_advisory_unlock($1, $2)', [...KEY]);
  } finally {
    holder.release();
    holder = null;
    await pool?.end();
    pool = null;
  }
}
