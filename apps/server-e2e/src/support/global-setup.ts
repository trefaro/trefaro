/**
 * Waits for the server to be ready before the API contract tests run.
 *
 * Nx starts `server:serve` as a continuous dependency of this target. An open
 * port is not enough to start asserting: the server applies its migrations on
 * boot, so the readiness signal has to be a response from `/api/health` with the
 * database reachable.
 */
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
        if (body.database === 'up') return;
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
