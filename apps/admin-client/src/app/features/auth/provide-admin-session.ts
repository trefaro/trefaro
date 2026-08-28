import {
  EnvironmentProviders,
  makeEnvironmentProviders,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { SetupService } from '../setup/setup.service';
import { AuthService } from './auth.service';

/**
 * Startup step: ask the server whether the cookie this browser already has is
 * still a session — and, if it has none, whether this instance has anybody at
 * all.
 *
 * Runs before the router, so {@link adminAuthGuard} can decide synchronously and
 * an organizer who reloads the page does not flash through the login form.
 * A failure is not fatal — it simply means "not logged in".
 *
 * The setup probe is skipped for a logged-in organizer: on an instance with
 * administrators it answers 404 every time, and the one thing it could tell them
 * is already known — somebody can log in, so the setup is over (E28). Both
 * services are injected before the first `await`, because the injection context
 * ends there.
 */
export function provideAdminSession(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      const setup = inject(SetupService);

      if (!(await auth.restore())) {
        await setup.probe();
      }
    }),
  ]);
}
