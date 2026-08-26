/**
 * Waits for the server and the client to answer before any test runs.
 *
 * Nx starts both as continuous task dependencies of the `e2e` target — see this
 * project's `project.json`. Playwright's own `webServer` is deliberately not
 * used: Nx infers its dependencies from that field and would then start the same
 * processes a second time, which collides on the port.
 */
const TARGETS = [
  process.env['API_HEALTH_URL'] ?? 'http://127.0.0.1:3000/api/health',
  process.env['BASE_URL'] ?? process.env['CLIENT_URL'] ?? '',
].filter(Boolean);

const TIMEOUT_MS = 150_000;

async function waitFor(url: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastError = 'never attempted';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `${url} did not become ready within ${TIMEOUT_MS / 1000}s (last: ${lastError}). ` +
      'Is PostgreSQL running? `docker compose -f infra/docker-compose.dev.yml up -d postgres`',
  );
}

export default async function globalSetup(): Promise<void> {
  await Promise.all(TARGETS.map(waitFor));
}
