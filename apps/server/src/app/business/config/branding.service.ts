import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { BrandingImageKind, BrandingImages } from '@trefaro/shared-models';
import {
  BRANDING_MIME_TYPES,
  MAX_BRANDING_BYTES,
  brandingTypeSummary,
  formatBytes,
} from '@trefaro/shared-models';
import {
  FILE_STORE,
  type FileStore,
  type ImageDimensions,
  imageDimensions,
  matchesSignature,
  signatureType,
} from '../attachments';
import { brandingImageUrls } from './branding-url';
import {
  APP_CONFIG_REPOSITORY,
  type AppConfigRecord,
  type AppConfigRepository,
} from './ports/app-config.repository';

/** An image on its way in, in the business layer's own terms. */
export interface BrandingImageUpload {
  /** What the request claimed — checked against the bytes, never trusted. */
  readonly mimeType: string;
  readonly bytes: Buffer;
}

/** An image on its way out to an anonymous visitor. */
export interface BrandingImageBytes {
  readonly mimeType: string;
  readonly bytes: Buffer;
}

/**
 * What an image is, without its bytes — for the one caller that has to describe
 * it rather than serve it.
 *
 * `dimensions` is `null` when the header does not say, which the PWA manifest
 * has a rule for. It is read here and nowhere else, so "what the picture is"
 * stays one question with one answer.
 */
export interface BrandingImageDescription {
  readonly mimeType: string;
  readonly dimensions: ImageDimensions | null;
}

/** The subtree of the upload volume branding files live in (E19). */
const BRANDING_AREA = 'branding';

/**
 * The organization's logo and app icon (FR 1.4, E19, E26).
 *
 * The one part of the whitelabel configuration that is not a value an
 * administrator types, and it is the reason this service exists separately from
 * `ConfigurationService`: an image has two halves — bytes in the volume
 * and a path in `app_config` — and the rules that keep the two in step have
 * nothing to do with the rules about a hexadecimal colour.
 *
 * Four promises, none of which a schema could make on its own:
 *
 * 1. **A branding file is never an attachment, in either direction.** It is
 *    written into its own area of the volume, the column refuses a path outside
 *    it (`CHK_app_config_branding_paths`), and {@link read} refuses one too —
 *    three layers for one property, because this is the only public route to
 *    stored bytes in the whole application and E9 says the others must stay shut.
 * 2. **The type is what the bytes say, not what the request said** (F38). On the
 *    way in the claim is checked against the signature; on the way out the
 *    signature alone decides the `Content-Type`, because a stored branding file
 *    has no name and no type column to lie in.
 * 3. **A replaced image is removed.** There are at most two of these files, so an
 *    orphan would be invisible forever rather than merely wasteful.
 * 4. **Nothing is written until everything has been checked.** A refused upload
 *    leaves the volume exactly as it was.
 *
 * What it deliberately does *not* do is *judge* the picture. E26 rules out an
 * image processing dependency, so no upload is ever refused for being the wrong
 * shape — the design page says what is wanted and shows a preview, and the byte
 * ceiling keeps the damage bounded. Since AP 12 it can {@link describe} one,
 * because the PWA manifest has to declare the size of the icon it points at
 * (F20) and a declared size is a claim a browser acts on. Reading two numbers
 * out of a header is not validation: nothing here decides anything because of
 * them.
 */
@Injectable()
export class BrandingService {
  private readonly logger = new Logger(BrandingService.name);

  constructor(
    @Inject(APP_CONFIG_REPOSITORY)
    private readonly appConfig: AppConfigRepository,
    @Inject(FILE_STORE) private readonly files: FileStore,
  ) {}

  /** Both URLs as they stand — what the upload endpoints answer with. */
  async urls(): Promise<BrandingImages> {
    return brandingImageUrls(await this.appConfig.load());
  }

  /**
   * Stores an image and points the configuration at it.
   *
   * The order matters: the bytes are written first, then the row, then the
   * previous file is removed. A failure between the first two steps leaves a
   * file nobody references, which is removed right here; a failure after them
   * would leave the *old* file behind, which is a wasted byte range rather than
   * a broken logo. Compensation in the direction that keeps the instance
   * rendering, exactly as `AttachmentsService` argues it.
   */
  async replace(
    kind: BrandingImageKind,
    image: BrandingImageUpload,
  ): Promise<BrandingImages> {
    this.assertAcceptable(image);

    const previous = pathOf(await this.appConfig.load(), kind);
    const stored = await this.files.save(BRANDING_AREA, image.bytes);

    let record: AppConfigRecord;
    try {
      record = await this.appConfig.setBrandingImage(kind, stored);
    } catch (error: unknown) {
      await this.files.remove([stored]);
      throw error;
    }

    if (previous) await this.files.remove([previous]);
    return brandingImageUrls(record);
  }

  /**
   * Takes the image away again.
   *
   * Clearing the column first: an instance that shows no logo is the state that
   * was asked for, whereas a column pointing at a file that is already gone
   * would render a broken image on every page.
   */
  async remove(kind: BrandingImageKind): Promise<BrandingImages> {
    const previous = pathOf(await this.appConfig.load(), kind);
    const record = await this.appConfig.setBrandingImage(kind, null);

    if (previous) await this.files.remove([previous]);
    return brandingImageUrls(record);
  }

  /**
   * The bytes behind one of the two public routes.
   *
   * `null` means "there is no such image", and it covers three cases that are
   * one thing from the outside: nothing was ever uploaded, the volume no longer
   * holds what the row names, and the file is not an image of a type this
   * instance serves. The last two are logged, because they are an operator's
   * problem and not the caller's.
   */
  async read(kind: BrandingImageKind): Promise<BrandingImageBytes | null> {
    const path = pathOf(await this.appConfig.load(), kind);
    if (!path) return null;

    // The third guard on E19, after the route (which takes no path at all) and
    // the check constraint. It is here because this is the function that would
    // do the damage: whatever ends up in that column, the one public route to
    // stored bytes only ever reads from the branding area.
    if (!path.startsWith(`${BRANDING_AREA}/`)) {
      this.logger.error(
        `app_config points the ${kind} at "${path}", which is outside the ` +
          'branding area — refusing to serve it.',
      );
      return null;
    }

    const bytes = await this.files.read(path);
    if (!bytes) {
      this.logger.error(
        `The ${kind} points at "${path}", which the upload volume does not hold.`,
      );
      return null;
    }

    const mimeType = signatureType(bytes, BRANDING_MIME_TYPES);
    if (!mimeType) {
      this.logger.error(
        `The ${kind} at "${path}" is not one of the image types this instance ` +
          'serves. It was checked when it was uploaded, so the file has changed ' +
          'since.',
      );
      return null;
    }

    return { mimeType, bytes };
  }

  /**
   * What an image is, for a caller that needs to describe it rather than serve
   * it.
   *
   * Built on {@link read}, so it inherits all three of its guards and its
   * `null` — an app icon outside the branding area or of a type this instance
   * does not serve is not describable either. The file is read in full for two
   * numbers, which is affordable because it is at most
   * {@link MAX_BRANDING_BYTES} and its one caller is a document a browser
   * fetches when it installs the application.
   *
   * The dimensions are not stored in `app_config`, deliberately and for the
   * reason AP 2 gave for not storing the media type: a column would be a second
   * place the truth lives, and the bytes are the first.
   */
  async describe(
    kind: BrandingImageKind,
  ): Promise<BrandingImageDescription | null> {
    const image = await this.read(kind);
    if (!image) return null;

    return {
      mimeType: image.mimeType,
      dimensions: imageDimensions(image.bytes),
    };
  }

  /**
   * Everything that has to hold before a byte is written.
   *
   * In the order in which being wrong about them gets more expensive: there is a
   * file at all, it is not too big to keep, its type is one that may be a brand,
   * and its first bytes agree with that type. The last check is the reason the
   * third is not enough (F38) — a `Content-Type` is set by whoever sends the
   * request, and this endpoint is the only one whose answer is later handed to
   * anonymous visitors as an image.
   */
  private assertAcceptable(image: BrandingImageUpload): void {
    if (image.bytes.length === 0) {
      throw new BadRequestException('The uploaded image is empty.');
    }

    if (image.bytes.length > MAX_BRANDING_BYTES) {
      throw new PayloadTooLargeException(
        `A logo or app icon may be up to ${formatBytes(MAX_BRANDING_BYTES)}; ` +
          `this file is ${formatBytes(image.bytes.length)}. Please export it ` +
          'at the size it is displayed at.',
      );
    }

    if (!BRANDING_MIME_TYPES.includes(image.mimeType)) {
      throw new BadRequestException(
        `A logo or app icon has to be one of: ${brandingTypeSummary()}. An SVG ` +
          'is not accepted — it can carry script, and it would be served from ' +
          'the same origin as the client that displays it.',
      );
    }

    if (!matchesSignature(image.mimeType, image.bytes)) {
      throw new BadRequestException(
        `This file is not ${image.mimeType} — its content does not match the ` +
          'type it was sent as.',
      );
    }
  }
}

/** Which stored path belongs to which kind; the read side of the `switch`. */
function pathOf(
  record: AppConfigRecord,
  kind: BrandingImageKind,
): string | null {
  return kind === 'logo' ? record.logoPath : record.appIconPath;
}
