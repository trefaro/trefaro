import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTrefaroConfig } from '@trefaro/shared-config';
import { provideTrefaroPlugins } from '@trefaro/shared-plugins';
import { appRoutes } from './app.routes';

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
    provideHttpClient(withFetch()),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideTrefaroConfig(),
    provideTrefaroPlugins(),
  ],
};
