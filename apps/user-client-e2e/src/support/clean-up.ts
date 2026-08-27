import { forgetAdminSession, removeSeededSeries } from './series-fixtures';

const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4200';

/**
 * Removes the seeded event series again.
 *
 * Test data that survives the run would slowly fill a developer's instance, and
 * the public start page is exactly where it would show up.
 */
export default async function globalTeardown(): Promise<void> {
  await removeSeededSeries(CLIENT_URL);
  // Last, and after the teardown that needs it: a session cookie left in the
  // temporary directory would be reused by the next run, whose server may have
  // booted with a different secret.
  forgetAdminSession();
}
