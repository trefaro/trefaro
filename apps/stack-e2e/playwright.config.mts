import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

/**
 * Drives a browser against the **shipped** stack — the five containers of
 * `infra/docker-compose.yml`, brought up from an empty volume by
 * `tools/shipped-stack/verify.sh`.
 *
 * It does not start anything. Unlike the two client suites, whose Nx targets
 * pull `server:serve` and a development server up as dependencies, this project
 * assumes the stack is already running and only waits for it to answer. That is
 * also why its target is called `e2e-stack` and not `e2e`: the `e2e` job runs
 * `nx run-many -t e2e`, and a project that needs a container stack must never
 * be swept up by it.
 *
 * Chromium only, and on purpose. The subject here is the service worker, and
 * Chromium is the engine whose worker Playwright drives without reservation;
 * Firefox and WebKit already cover the two client suites, where the behaviour
 * that differs between engines actually lives. A second engine here would
 * double a container run to re-assert what the other suites assert better.
 */
const baseURL =
  process.env['STACK_BASE_URL'] ??
  process.env['BASE_URL'] ??
  'http://localhost:8080';

export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  /* A cold container answers its first navigation slower than a warm
   * development server, and the service worker registers only once the
   * application is stable (`registerWhenStable:30000`). */
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    /* Service workers are the subject of this project, so they must not be
     * bypassed — Playwright's default already lets them run, and this says so
     * out loud because switching it off would make every assertion here pass
     * for the wrong reason. */
    serviceWorkers: 'allow',
  },
  /* Waits for the stack, and fails with a sentence rather than a timeout when
   * nothing is listening. */
  globalSetup: './src/support/wait-for-stack.ts',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
