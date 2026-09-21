import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4300';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import 'dotenv/config';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Generated as a .mts file so Node forces ESM regardless of workspace
 * `type`. Playwright routes `.mts` through its ESM loader (dynamic import,
 * bypassing the pirates CJS-compile path), and Nx's native TS strip loads
 * `.mts` directly. Playwright's configLoader auto-discovers
 * `playwright.config.mts` via its extension list
 * (.ts/.js/.mts/.mjs/.cts/.cjs).
 */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  /* Playwright's 5s default is tight against a development server: the first
   * navigation to a lazily loaded route compiles and ships that chunk on
   * demand, so a route nobody has visited yet costs seconds once per run. A
   * page that is actually broken never appears at all, so the longer budget
   * costs nothing but flake. */
  expect: { timeout: 10_000 },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Nx starts the API server and the client as continuous dependencies of the
   * e2e target (see project.json). Playwright's own dev-server option is
   * deliberately unused: Nx infers its dependencies from that field and would
   * then start the same processes a second time, colliding on the port. This
   * setup only waits for them to answer. */
  globalSetup: './src/support/wait-for-servers.ts',
  /* Removes the event series the suite created, including any a failed run left
   * behind. */
  globalTeardown: './src/support/clean-up.ts',
  projects: [
    /* The three engines run everything but the tablet selection: what
     * `@layout` asserts is only true at 768 pixels, and at 1280 it would fail
     * for the right reason (nothing scrolls, so no frame scrolls either). */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@layout/,
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      grepInvert: /@layout/,
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      grepInvert: /@layout/,
    },

    /* The floor of E67, and the counterpart of the participant suite's
     * `phone` project (E68): one engine, a marked selection, and no login of
     * its own — the session comes from the global setup like every other
     * test's. The width is written out rather than inherited from a device
     * profile, because the number is the decision. */
    {
      name: 'tablet',
      grep: /@layout/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
      },
    },

    // Uncomment for mobile browsers support
    /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

    // Uncomment for branded browsers
    /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
  ],
});
