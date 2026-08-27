import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Where the signed-in browser state is kept between the global setup and the
 * tests.
 *
 * In the temporary directory rather than under `dist/`: the file contains a live
 * session cookie, and `dist/.playwright` is what CI uploads as an artifact on
 * failure.
 */
export const ADMIN_STORAGE_STATE = join(
  tmpdir(),
  'trefaro-admin-e2e-state.json',
);

/**
 * Prefix of every event series this suite creates.
 *
 * The teardown deletes by it, so a run that fails midway cannot leave rows that
 * make the next run fail for an unrelated reason.
 */
export const SERIES_SLUG_PREFIX = 'e2e-series-';

/**
 * A label that is unique across every worker of a run, without a clock.
 *
 * Fixture names — and therefore slugs — used to be `<engine> <Date.now()>`, and
 * two workers seeding in the same millisecond then collided on the unique slug
 * index. The failure read like a broken fixture and appeared perhaps one run in
 * twenty, which is the worst kind. A worker is a process, so its pid separates
 * it from every other; the counter separates repeated seeds inside it.
 *
 * `scope` is what the label is for — the engine, or the spec — so a name is
 * still readable in the database while a run is going wrong.
 */
let sequence = 0;

export function fixtureLabel(scope: string): string {
  sequence += 1;
  return `${scope}-${process.pid}-${sequence}`;
}

export const ADMIN_CREDENTIALS = {
  email: process.env['ADMIN_BOOTSTRAP_EMAIL'] ?? '',
  password: process.env['ADMIN_BOOTSTRAP_PASSWORD'] ?? '',
};

export function requireCredentials(): { email: string; password: string } {
  if (!ADMIN_CREDENTIALS.email || !ADMIN_CREDENTIALS.password) {
    throw new Error(
      'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set for the ' +
        'organizer client e2e suite — the same values the server booted with. ' +
        'Add them to .env.',
    );
  }
  return { ...ADMIN_CREDENTIALS };
}
