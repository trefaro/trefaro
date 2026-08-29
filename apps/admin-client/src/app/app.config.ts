import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTrefaroConfig } from '@trefaro/shared-config';
import {
  provideTrefaroTitles,
  provideTrefaroTranslations,
} from '@trefaro/shared-i18n';
import { provideTrefaroPlugins } from '@trefaro/shared-plugins';
import { appRoutes } from './app.routes';
import { provideAdminSession } from './features/auth/provide-admin-session';
import { unauthorizedInterceptor } from './features/auth/unauthorized.interceptor';

/**
 * Organizer client (desktop-first, but usable on a phone — NFR 6).
 *
 * Runs the same client start sequence as the participant client and against the
 * same configuration endpoint, which is what makes a theme change take effect in
 * both clients at once (FR 1.4). No service worker here: an organizer works at a
 * desk, and there is no offline story to justify the cache.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      withFetch(),
      // An expired session becomes a trip to the login form rather than a page
      // full of failed requests.
      withInterceptors([unauthorizedInterceptor]),
    ),
    provideRouter(appRoutes, withComponentInputBinding()),
    // Route titles are catalogue keys, and the tab ends in the organization's
    // name rather than in the product's (F60).
    provideTrefaroTitles(),
    provideTrefaroConfig(),
    // The interface's own text, from the server rather than from this image
    // (E22). Behind the configuration, which is what says which languages
    // exist; ahead of the first render, so no screen paints its keys first.
    provideTrefaroTranslations(),
    provideAdminSession(),
    provideTrefaroPlugins(),
  ],
};
