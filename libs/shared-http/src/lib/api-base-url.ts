import { InjectionToken } from '@angular/core';

/**
 * Base path of the Trefaro API.
 *
 * A path, not an origin: both clients are served from the same host as the API
 * behind the NGINX reverse proxy, so a same-origin path avoids CORS entirely in
 * production. In development the Angular dev server proxies it (see each
 * client's `proxy.conf.json`).
 */
export const API_BASE_URL = new InjectionToken<string>('TREFARO_API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
