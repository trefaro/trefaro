import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { AppConfigService } from '@trefaro/shared-config';
import { ParticipantSessionService } from './participant-session.service';

/**
 * Startup step after the configuration: ask the server whether the cookie this
 * browser already has is still a session (FR 4.2).
 *
 * Ordered by dependency rather than by registration order, the way the
 * catalogue fetch is: `AppConfigService.ensureLoaded()` caches its promise, so
 * this awaits the same single request the theme awaited, and only then asks —
 * whether accounts exist on this instance is a fact from the configuration
 * (F53), and asking before knowing it would mean a request that is pointless
 * on an instance without accounts.
 *
 * Runs before the router, so {@link participantSessionGuard} can decide
 * synchronously. A failure is not fatal: it means "not logged in", which is the
 * state almost every visitor of this client is in.
 */
export function provideParticipantSession(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(async () => {
      const config = inject(AppConfigService);
      const session = inject(ParticipantSessionService);

      try {
        await config.ensureLoaded();
      } catch {
        // Reported by the API client's error mapping. Without the
        // configuration the client cannot know whether accounts exist, and
        // guessing "yes" would put a login form on an instance that has none.
        return;
      }
      await session.restore();
    }),
  ]);
}
