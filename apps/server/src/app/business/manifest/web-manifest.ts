import { createHash } from 'node:crypto';
import {
  MIN_INSTALLABLE_ICON_PX,
  SHIPPED_APP_ICONS,
  type WebManifest,
  type WebManifestIcon,
} from '@trefaro/shared-models';

/** The uploaded app icon, as much as is known about it without a picture. */
export interface AppIconInput {
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
}

/** Everything the document is built from — no service, no database, no clock. */
export interface WebManifestInput {
  readonly organizationName: string;
  readonly description: string;
  readonly locale: string;
  readonly themeColor: string;
  readonly appIcon: AppIconInput | null;
}

/**
 * The colour behind the splash screen while an installed client starts.
 *
 * White rather than the primary colour, and not configurable: this is the page
 * the application paints onto, and both clients' own background is white. A
 * splash in the brand colour that hands over to a white page is a flash.
 */
const BACKGROUND_COLOR = '#ffffff';

/**
 * Builds the manifest of one instance (F20, E26).
 *
 * A pure function with a single caller, because everything interesting about
 * this document is a decision rather than a lookup, and a decision is worth a
 * test that needs no database:
 *
 * - **The name is the organization's.** That is the whole of E26 — a home screen
 *   that says "Trefaro" is the product's brand on somebody else's phone.
 * - **`theme_color` is the primary colour**, so the system chrome and the splash
 *   of an installed client match the pages inside it. It follows a colour change
 *   at the next install; an already installed client keeps what it was installed
 *   with, which is why the design page cannot promise otherwise.
 * - **An uploaded icon is declared `"any"`, never `"maskable"`** (E26). The
 *   shipped icons carry a safe zone because they were drawn with one; claiming
 *   the same for an image we have not seen is how a logo gets its edges shaved
 *   off by an Android launcher.
 * - **A usable upload replaces the shipped set; anything else joins it.** Usable
 *   means square and at least {@link MIN_INSTALLABLE_ICON_PX} on a side, read
 *   from the file's own header. Listing the shipped icons beside a good upload
 *   would let a browser pick Trefaro's icon over the organization's; dropping
 *   them for an upload that is too small, oblong or unreadable would leave the
 *   instance *uninstallable* — a failure nobody sees until they try. So the rule
 *   points both ways, and the design page's preview stays the place where a bad
 *   icon is noticed.
 */
export function buildWebManifest(input: WebManifestInput): WebManifest {
  return {
    // `id` pins the application's identity across a changed `start_url`: without
    // it a browser identifies an installed app by its start URL, and moving that
    // would install a second copy beside the first.
    id: '/',
    name: input.organizationName,
    short_name: input.organizationName,
    description: input.description,
    lang: input.locale,
    display: 'standalone',
    orientation: 'portrait-primary',
    scope: '/',
    start_url: '/',
    theme_color: input.themeColor,
    background_color: BACKGROUND_COLOR,
    icons: iconsFor(input.appIcon),
  };
}

/**
 * A tag over the served bytes.
 *
 * The same argument as the catalogue's: several independent things decide this
 * answer — the configuration row, the uploaded file, the shipped icon list and
 * the catalogue text — and hashing the result covers all of them, including a
 * new image that ships different icons.
 */
export function webManifestEtag(manifest: WebManifest): string {
  const digest = createHash('sha256')
    .update(JSON.stringify(manifest))
    .digest('base64url')
    .slice(0, 22);
  return `"${digest}"`;
}

function iconsFor(appIcon: AppIconInput | null): readonly WebManifestIcon[] {
  if (!appIcon) return SHIPPED_APP_ICONS;

  const uploaded: WebManifestIcon = {
    src: appIcon.url,
    sizes: sizesOf(appIcon),
    // No `type`: the stored file has no type column, and reading its first
    // bytes again to name a hint a browser may ignore is not worth the read.
    purpose: 'any',
  };

  return installable(appIcon) ? [uploaded] : [uploaded, ...SHIPPED_APP_ICONS];
}

/**
 * Whether a browser can install an application from this icon alone.
 *
 * Square, because a launcher crops to a square and an oblong icon is refused
 * outright; big enough, because the floor is a browser's and not ours.
 */
function installable(appIcon: AppIconInput): boolean {
  const { width, height } = appIcon;
  return (
    width !== null &&
    height !== null &&
    width === height &&
    width >= MIN_INSTALLABLE_ICON_PX
  );
}

/**
 * `"any"` when the header did not say — the one honest answer left.
 *
 * It means "scalable" to a browser, which is not quite true of a raster image,
 * but the alternative is either a number nobody read or no `sizes` at all, and
 * an icon without `sizes` ranks last everywhere. The shipped icons stay in the
 * list in exactly this case, so nothing depends on the guess.
 */
function sizesOf(appIcon: AppIconInput): string {
  return appIcon.width !== null && appIcon.height !== null
    ? `${appIcon.width}x${appIcon.height}`
    : 'any';
}
