/**
 * The installable participant client (FR 1.4, F20, E26, E27).
 *
 * A manifest with `name: "Trefaro"` is not a whitelabel application, so the
 * document is built per instance by the server rather than shipped as a file
 * (E26). What stays in the image is the icon set below: eight PNGs in the
 * participant client's `public/icons`, drawn with the safe zone a maskable icon
 * needs. They are what an instance that has uploaded nothing installs as.
 *
 * The list lives here rather than in the server because two projects have to
 * agree on it: the server writes these paths into the manifest, and the
 * participant client is the container that answers for them. A rename that
 * touches only one side is caught by `shipped-icons.spec.ts`, which checks every
 * `src` against the files on disk.
 */

/** One entry of the manifest's `icons` array, as this application writes them. */
export interface WebManifestIcon {
  readonly src: string;
  /** `"<w>x<h>"`, or `"any"` for an image whose pixels nobody has measured. */
  readonly sizes: string;
  /** Omitted when the type is not known without reading the file. */
  readonly type?: string;
  readonly purpose: string;
}

/** The document `GET /api/config/manifest.webmanifest` answers with. */
export interface WebManifest {
  readonly id: string;
  readonly name: string;
  readonly short_name: string;
  readonly description: string;
  readonly lang: string;
  readonly display: 'standalone';
  readonly orientation: 'portrait-primary';
  readonly scope: string;
  readonly start_url: string;
  readonly theme_color: string;
  readonly background_color: string;
  readonly icons: readonly WebManifestIcon[];
}

/**
 * The media type a manifest is served with.
 *
 * Not `application/json`: a browser fetching `<link rel="manifest">` accepts
 * either, but the proxy compresses by type and an operator reading the routing
 * table should see what the document is.
 */
export const WEB_MANIFEST_MIME_TYPE = 'application/manifest+json';

/** Where both clients and the reverse proxy expect the manifest. */
export const WEB_MANIFEST_PATH = '/api/config/manifest.webmanifest';

/**
 * The smallest square icon a browser will install an application from.
 *
 * Chromium's floor, and the only reason this number exists here: an uploaded
 * icon below it — or one that is not square — would leave the instance
 * *uninstallable* if it were the only entry in the list, which is a failure
 * nobody would see until they tried to install. So the shipped set stays beside
 * such an upload; see `buildWebManifest` in the server for the rule.
 */
export const MIN_INSTALLABLE_ICON_PX = 144;

/**
 * The icons every instance has, in ascending size.
 *
 * `purpose: "maskable any"` because they carry the safe zone an Android
 * launcher crops to *and* work unmasked elsewhere. An uploaded icon is never
 * declared maskable (E26): claiming a safe zone in an image we have not seen is
 * how a logo ends up with its edges shaved off.
 */
export const SHIPPED_APP_ICONS: readonly WebManifestIcon[] = [
  72, 96, 128, 144, 152, 192, 384, 512,
].map((size) => ({
  src: `/icons/icon-${size}x${size}.png`,
  sizes: `${size}x${size}`,
  type: 'image/png',
  purpose: 'maskable any',
}));
