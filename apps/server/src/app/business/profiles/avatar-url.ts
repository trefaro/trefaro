import { MEDIA_URL_PREFIX } from '../config';

/**
 * The public URL of a profile picture (FR 4.3 — F124).
 *
 * A pure function and not a service, like `logo-url.ts`: its callers are the
 * mappers that turn a row into the shape a client sees, and everything they
 * need is already on the record.
 *
 * The two properties are the ones `logo-url.ts` argues for, applied to a
 * person:
 *
 * - **The URL contains no stored path.** It names the account, and the route
 *   resolves the file through it. A URL carrying `avatar_path` would be an
 *   invitation to try a neighbouring path, and the neighbours are registration
 *   attachments (E9).
 * - **A new picture is a new URL.** `?v=` carries the row's `updated_at`, which
 *   lets the bytes be served `immutable`. The picture is written through
 *   `setAvatarPath`, which moves `updated_at` — so the version moves when the
 *   image does, and the aggressive caching stays honest.
 */

/** `null` in, `null` out: an account without a picture has no address for one. */
export function avatarUrl(
  profileId: string,
  storedPath: string | null,
  updatedAt: Date,
): string | null {
  if (!storedPath) return null;
  // Epoch milliseconds, like every other media URL: it is a cache key, nobody
  // reads it, and it survives a URL without escaping.
  return `${MEDIA_URL_PREFIX}/profiles/${profileId}/avatar?v=${updatedAt.getTime()}`;
}
