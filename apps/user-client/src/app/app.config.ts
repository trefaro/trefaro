import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
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
    provideRouter(appRoutes, withComponentInputBinding()),
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
