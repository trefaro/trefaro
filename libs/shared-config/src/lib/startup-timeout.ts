import { InjectionToken } from '@angular/core';

/**
 * How long a client waits for the server during startup before rendering
 * anyway.
 *
 * Without a bound, a server that accepts the connection and then never answers
 * — a dev-server proxy in front of a stopped API, a container mid-restart —
 * leaves the startup promise pending, and Angular renders nothing at all. A
 * blank page is the worst possible answer: NFR 10 asks that a fault degrade the
 * application, not stop it. Five seconds is long enough for a slow instance and
 * short enough that nobody concludes the product is broken.
 *
 * An injection token rather than a constant so tests do not have to wait.
 */
export const STARTUP_TIMEOUT_MS = new InjectionToken<number>(
  'trefaro.startupTimeoutMs',
  { providedIn: 'root', factory: () => 5_000 },
);
