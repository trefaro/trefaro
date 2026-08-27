/**
 * Public URL under which files stored by this instance are served.
 *
 * Stored paths are relative to the upload volume, never external URLs — a
 * whitelabel instance serves its own logos so nothing leaks to a third party
 * (NFR 9). The endpoint that serves them arrives with the whitelabel theming in
 * phase 2, which is what first stores a logo; until then the mapping exists so
 * every module already speaks the same URL shape.
 *
 * Deliberately *not* the way to a registration's attachments (E9): those can be
 * passport scans, go only to authenticated administrative requests, and have
 * their own endpoint — `GET /api/admin/attachments/:id`.
 */
export const MEDIA_URL_PREFIX = '/api/media';

export function toMediaUrl(storedPath: string | null): string | null {
  return storedPath ? `${MEDIA_URL_PREFIX}/${storedPath}` : null;
}
