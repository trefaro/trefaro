import type { BrandingImageKind } from '@trefaro/shared-models';
import type { AppConfigRecord } from './ports/app-config.repository';

/**
 * The public URLs of the two branding images (E19).
 *
 * One place, because three things have to agree on them: `/api/config`, which
 * both clients read before their first paint; the answers of the upload
 * endpoints, so the design page can show what it just uploaded; and the PWA
 * manifest of AP 12.
 *
 * Two properties are the whole point:
 *
 * - **The URL contains no stored path.** It names the kind of image, and the
 *   route resolves it through `app_config`. A URL carrying `logo_path` — which is
 *   what phase 1 built as a placeholder — is an invitation to try a neighbouring
 *   path, and the neighbours are registration attachments (E9).
 * - **A new image is a new URL.** `?v=` carries `updated_at`, which lets the
 *   bytes be served `immutable` — the aggressive caching is only safe because
 *   the clients re-read `/api/config` on every start and therefore learn the new
 *   URL before they could paint a stale image.
 */

/** Public URL prefix under which files stored by this instance are served. */
export const MEDIA_URL_PREFIX = '/api/media';

/**
 * Everything below this prefix is public, and only these two paths exist.
 *
 * Deliberately a different subtree of the URL space from
 * `/api/admin/attachments/:id`: one is readable by anyone, the other only with
 * an administrative session, and the two must not be confusable — not by a
 * caller and not by whoever reads the routing table next.
 */
export const BRANDING_URL_PREFIX = `${MEDIA_URL_PREFIX}/branding`;

/** The two URLs as the configuration payload and the upload answers carry them. */
export interface BrandingImageUrls {
  readonly logoUrl: string | null;
  readonly appIconUrl: string | null;
}

export function brandingImageUrls(record: AppConfigRecord): BrandingImageUrls {
  return {
    logoUrl: brandingImageUrl('logo', record.logoPath, record.updatedAt),
    appIconUrl: brandingImageUrl(
      'app-icon',
      record.appIconPath,
      record.updatedAt,
    ),
  };
}

function brandingImageUrl(
  kind: BrandingImageKind,
  storedPath: string | null,
  updatedAt: Date,
): string | null {
  if (!storedPath) return null;
  // Epoch milliseconds rather than the ISO string: it is a cache key, nobody
  // reads it, and it survives a URL without escaping.
  return `${BRANDING_URL_PREFIX}/${kind}?v=${updatedAt.getTime()}`;
}
