import {
  EnvironmentProviders,
  makeEnvironmentProviders,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Startup step: ask the server whether the cookie this browser already has is
 * still a session.
 *
 * Runs before the router, so {@link adminAuthGuard} can decide synchronously and
 * an organizer who reloads the page does not flash through the login form.
 * A failure is not fatal — it simply means "not logged in".
 */
export function provideAdminSession(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(async () => {
      await inject(AuthService).restore();
    }),
  ]);
}
