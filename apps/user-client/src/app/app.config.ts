import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTrefaroConfig } from '@trefaro/shared-config';
import { provideTrefaroPlugins } from '@trefaro/shared-plugins';
import { appRoutes } from './app.routes';

/**
 * Participant client (mobile-first, installable PWA).
 *
 * The two Trefaro providers implement the client start sequence: fetch the
 * configuration and apply the theme, then load the enabled plug-ins' web
 * components. Both run before the first render, and neither blocks startup when
 * the server is unreachable — the public start page and event landing page have
 * to work regardless.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    // Route parameters are bound to component inputs, so a page reads
    // `eventId` as a signal input instead of subscribing to the route.
    //
    // `anchorScrolling` because the event detail view leads to its own sections
    // through tiles (FR 1.5): they navigate to the current route with a fragment,
    // and without this the URL would change and nothing would move.
    provideRouter(
      appRoutes,
      withComponentInputBinding(),
      withInMemoryScrolling({ anchorScrolling: 'enabled' }),
    ),
    provideTrefaroConfig(),
    provideTrefaroPlugins(),
    provideServiceWorker('ngsw-worker.js', {
      // Angular only registers the service worker in a production build, which
      // is also why Web Push can only be tested against a production build.
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
