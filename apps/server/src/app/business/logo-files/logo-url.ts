import { MEDIA_URL_PREFIX } from '../config';

/**
 * The public URLs of a series logo and an event logo (FR 2.1, FR 3.1 — E19).
 *
 * Pure functions and not a service, because their two callers are the mappers
 * that turn a row into its public shape — `toPublicEventSeries` and
 * `toPublicEvent` — and those run inside a `map` over a list. Everything they
 * need is already on the record.
 *
 * The two properties are the ones `branding-url.ts` argues for, applied to a
 * row:
 *
 * - **The URL contains no stored path.** It names the row, and the route
 *   resolves the file through it. A URL carrying `logo_path` — which is what
 *   phase 1 sketched and AP 2 of phase 2 removed — is an invitation to try a
 *   neighbouring path, and the neighbours are registration attachments (E9).
 * - **A new image is a new URL.** `?v=` carries the row's `updated_at`, which
 *   lets the bytes be served `immutable`. Writing a logo goes through
 *   `setLogoPath`, which touches `updated_at` — so the version moves when the
 *   picture does, and the aggressive caching stays honest.
 *
 * The id is in the path rather than in a query parameter, unlike `?v=`: it is
 * *which* image this is, not *which version* of it.
 */

/** `null` in, `null` out: a row without a logo has no address for one. */
export function seriesLogoUrl(
  seriesId: string,
  storedPath: string | null,
  updatedAt: Date,
): string | null {
  return logoUrl(`series/${seriesId}`, storedPath, updatedAt);
}

export function eventLogoUrl(
  eventId: string,
  storedPath: string | null,
  updatedAt: Date,
): string | null {
  return logoUrl(`events/${eventId}`, storedPath, updatedAt);
}

function logoUrl(
  segment: string,
  storedPath: string | null,
  updatedAt: Date,
): string | null {
  if (!storedPath) return null;
  // Epoch milliseconds, like the branding URLs: it is a cache key, nobody reads
  // it, and it survives a URL without escaping.
  return `${MEDIA_URL_PREFIX}/${segment}/logo?v=${updatedAt.getTime()}`;
}
