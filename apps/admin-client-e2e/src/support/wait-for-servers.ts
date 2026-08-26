import { request } from '@playwright/test';
import { ADMIN_STORAGE_STATE, requireCredentials } from './admin-session';

/**
 * Waits for the server and the client to answer, then signs in once.
 *
 * Nx starts both as continuous task dependencies of the `e2e` target — see this
 * project's `project.json`. Playwright's own `webServer` is deliberately not
 * used: Nx infers its dependencies from that field and would then start the same
 * processes a second time, which collides on the port.
 *
 * The sign-in happens here, once for the whole run, and the browser state is
 * saved for the specs that need a workspace. That is not only faster: the login
 * is rate limited per address, and a suite that logged in per test in three
 * browsers would lock itself out. The specs that exercise the login itself
 * start from a fresh context instead.
 */
const CLIENT_URL =
  process.env['BASE_URL'] ??
  process.env['CLIENT_URL'] ??
  'http://localhost:4300';

const TARGETS = [
  process.env['API_HEALTH_URL'] ?? 'http://127.0.0.1:3000/api/health',
  CLIENT_URL,
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

async function signInOnce(): Promise<void> {
  // Through the client's origin, not the server's port: the dev server proxies
  // `/api`, so the session cookie ends up on the origin the tests browse.
  const context = await request.newContext({ baseURL: CLIENT_URL });
  try {
    const response = await context.post('/api/admin/auth/login', {
      data: requireCredentials(),
    });
    if (!response.ok()) {
      throw new Error(
        `Signing in for the e2e run failed with status ${response.status()}. ` +
          'Do ADMIN_BOOTSTRAP_* match the account the server created?',
      );
    }
    await context.storageState({ path: ADMIN_STORAGE_STATE });
  } finally {
    await context.dispose();
  }
}

export default async function globalSetup(): Promise<void> {
  await Promise.all(TARGETS.map(waitFor));
  await signInOnce();
}
