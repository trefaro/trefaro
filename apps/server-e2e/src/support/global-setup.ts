/**
 * Waits for the server, then signs in once for the whole run.
 *
 * Nx starts `server:serve` as a continuous dependency of this target. An open
 * port is not enough to start asserting: the server applies its migrations on
 * boot, so the readiness signal has to be a response from `/api/health` with the
 * database reachable.
 *
 * The single login is the other half of this file's job — see
 * `admin-session.ts` for why the suites share one rather than logging in each.
 */
import { establishAdminSession } from './admin-session';

const BASE_URL = `http://127.0.0.1:${process.env['SERVER_PORT'] ?? '3000'}`;
const TIMEOUT_MS = 150_000;

module.exports = async function globalSetup(): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastError = 'never attempted';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) {
        const body = (await response.json()) as { database?: string };
        if (body.database === 'up') {
          await establishAdminSession();
          return;
        }
        lastError = `database is ${body.database}`;
      } else {
        lastError = `status ${response.status}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `${BASE_URL} was not ready within ${TIMEOUT_MS / 1000}s (last: ${lastError}). ` +
      'Is PostgreSQL running? `docker compose -f infra/docker-compose.dev.yml up -d postgres`',
  );
};
