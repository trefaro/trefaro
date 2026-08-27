/**
 * Public URL under which files stored by this instance are served.
 *
 * Stored paths are relative to the upload volume, never external URLs — a
 * whitelabel instance serves its own logos so nothing leaks to a third party
 * (NFR 9). The endpoint that actually serves them arrives with the uploads in
 * AP 7; until then the mapping exists so every module already speaks the same
 * URL shape.
 */
export const MEDIA_URL_PREFIX = '/api/media';

export function toMediaUrl(storedPath: string | null): string | null {
  return storedPath ? `${MEDIA_URL_PREFIX}/${storedPath}` : null;
}
