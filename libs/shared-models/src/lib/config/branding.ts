/**
 * The two images an organization uploads (FR 1.4, E19, E26).
 *
 * Both live in `app_config` as storage-relative paths, both are served without a
 * login, and neither is reachable by naming a path — the routes are
 * `GET /api/media/branding/logo` and `…/app-icon`, and they answer with exactly
 * what the configuration row points at. That is the whole of E19: a logo has to
 * be visible to anonymous visitors while an attachment must never be (E9), and
 * the only way both hold at once is that the two kinds of file cannot be
 * confused for one another — separate subtree in the volume, separate route, and
 * no caller-supplied path anywhere near either.
 *
 * Why two images rather than one (E26): a logo is usually wide, and a wide image
 * on a home screen gets cropped to a square by the operating system. An instance
 * with no app icon keeps the shipped Trefaro icons, which are drawn for
 * `purpose: "maskable"` — an uploaded one is declared `"any"`, because claiming a
 * safe zone we have not seen is how a logo ends up with its edges shaved off.
 */
import type { UploadType } from '../registrations/upload';

/** The kinds, in the order the design settings offer them. */
export const BRANDING_IMAGE_KINDS = ['logo', 'app-icon'] as const;

export type BrandingImageKind = (typeof BRANDING_IMAGE_KINDS)[number];

export function isBrandingImageKind(
  value: unknown,
): value is BrandingImageKind {
  return (
    typeof value === 'string' &&
    (BRANDING_IMAGE_KINDS as readonly string[]).includes(value)
  );
}

/**
 * The two public image URLs, as the upload and removal endpoints answer them.
 *
 * Both of them every time, not only the one that just changed: the version in
 * `?v=` is `app_config.updated_at` and therefore belongs to the row, so
 * replacing the logo gives the app icon a new URL as well. A response carrying
 * one of them would leave the design page holding an address that is no longer
 * the current one.
 *
 * The same two values appear in `AppConfig` — `theme.logoUrl` and `appIconUrl` —
 * because that is where an anonymous visitor reads them. This type is what the
 * writing side answers with.
 */
export interface BrandingImages {
  readonly logoUrl: string | null;
  readonly appIconUrl: string | null;
}

/**
 * What may be uploaded as a logo or an app icon.
 *
 * Its own list, not the registration form's catalogue (`UPLOAD_TYPES`): the two
 * answer different questions. That one asks what a participant may attach to a
 * form — a PDF or a Word document belongs there and would be a nonsensical
 * logo. This one asks what may be rendered as this instance's brand, in an
 * `<img>` in both clients and as a PWA icon.
 *
 * **No SVG**, and that is a security decision rather than a taste one: an SVG is
 * a document that may carry script, and this one would be served from the
 * origin of the client that displays it — an uploaded logo would then be that
 * client's own code. The upload is behind an administrative session, so this is
 * not the first line of defence; it is the one that still holds if a session is
 * ever taken over. The cost is real (a vector logo has to be exported once), and
 * it is the right trade for NFR 7.
 *
 * Every type here also needs a signature in the server's `file-signature.ts`,
 * for the same reason F38 gave: a type whose first bytes nobody checks is a type
 * whose name is a claim.
 */
export const BRANDING_TYPES: readonly UploadType[] = [
  { mimeType: 'image/png', label: 'PNG', extensions: ['.png'] },
  { mimeType: 'image/jpeg', label: 'JPEG', extensions: ['.jpg', '.jpeg'] },
  { mimeType: 'image/webp', label: 'WebP', extensions: ['.webp'] },
];

export const BRANDING_MIME_TYPES: readonly string[] = BRANDING_TYPES.map(
  (type) => type.mimeType,
);

/**
 * The most a branding image may weigh.
 *
 * Twenty times smaller than `MAX_UPLOAD_BYTES`, and the reason is not
 * disk: this file is fetched by every visitor before the first paint of a
 * mobile-first client, and it is the one image on the page that is not part of
 * the content. A logo above half a megabyte is an export nobody looked at — a
 * PNG at the sizes involved is a few tens of kilobytes, a WebP less.
 *
 * It bounds the request as well as the file. The endpoint is authenticated, so
 * this is not the bound on what a stranger can send; it is what an organizer
 * gets told about in words instead of watching a proxy refuse a body.
 */
export const MAX_BRANDING_BYTES = 512 * 1024;

/**
 * The multipart part that carries the image.
 *
 * Part of the contract rather than of either side, like
 * `REGISTRATION_PAYLOAD_PART`: the request is `multipart/form-data` with exactly
 * one part, because that is what a browser sends for `<input type="file">` and a
 * raw body would need the client to set the type header by hand.
 */
export const BRANDING_IMAGE_PART = 'file';

/**
 * What the design page shows under each upload, and what the API says on a 400.
 *
 * One sentence in one place, so the hint an organizer reads before uploading and
 * the message they read after a refusal cannot describe different rules.
 */
export function brandingTypeSummary(): string {
  return BRANDING_TYPES.map((type) => type.label).join(', ');
}
