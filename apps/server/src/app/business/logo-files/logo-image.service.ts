import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  BRANDING_MIME_TYPES,
  MAX_BRANDING_BYTES,
  brandingTypeSummary,
  formatBytes,
} from '@trefaro/shared-models';
import {
  FILE_STORE,
  type FileStore,
  matchesSignature,
  signatureType,
} from '../attachments';
import {
  LOGO_PATHS_REPOSITORY,
  type LogoPathsRepository,
} from './ports/logo-paths.repository';

/** An image on its way in, in the business layer's own terms. */
export interface LogoUpload {
  /** What the request claimed — checked against the bytes, never trusted. */
  readonly mimeType: string;
  readonly bytes: Buffer;
}

/** An image on its way out to an anonymous visitor. */
export interface LogoBytes {
  readonly mimeType: string;
  readonly bytes: Buffer;
}

/** The subtree of the upload volume row logos live in (E19). */
const LOGO_AREA = 'logos';

/**
 * The bytes of a series or event logo (FR 2.1, FR 3.1).
 *
 * The half of a row logo that has nothing to do with series or events: what may
 * be uploaded, where it is kept, and what comes back out. `EventSeriesService`
 * and `EventsService` own the other half — which row it belongs to, who may
 * change it, and what a missing row answers — and they each keep their own 404
 * rule rather than delegating it here.
 *
 * That split is why this is a service and not a second `BrandingService`. The
 * two are almost the same object: the same catalogue of types, the same ceiling,
 * the same three-layer promise about the subtree. What differs is where the path
 * is kept — one column of one row in `app_config` against one column of many
 * rows in two tables — and that is exactly the part a shared service cannot
 * hold without knowing about both tables.
 *
 * The promises it does make, all of them the branding ones:
 *
 * 1. **A logo file is never an attachment, in either direction.** It is written
 *    into its own area, the columns refuse a path outside it
 *    (`CHK_event_series_logo_path`, `CHK_event_logo_path`), and {@link read}
 *    refuses one too. Three layers, because these are public routes to stored
 *    bytes and E9 says the others stay shut.
 * 2. **The type is what the bytes say, not what the request said** (F38). On the
 *    way in the claim is checked against the signature; on the way out the
 *    signature alone decides the `Content-Type`, because a stored logo has no
 *    name and no type column to lie in.
 * 3. **Nothing is written until everything has been checked.** A refused upload
 *    leaves the volume exactly as it was.
 *
 * What it deliberately does not do is judge the picture. E26 rules out an image
 * processing dependency, so no upload is refused for being the wrong shape — the
 * form says what is wanted and shows a preview.
 */
@Injectable()
export class LogoImageService {
  private readonly logger = new Logger(LogoImageService.name);

  constructor(
    @Inject(FILE_STORE) private readonly files: FileStore,
    @Inject(LOGO_PATHS_REPOSITORY) private readonly paths: LogoPathsRepository,
  ) {}

  /**
   * Checks an upload and writes its bytes.
   *
   * @returns the stored path, for the caller to put in its row. Deliberately
   * two steps: the file exists before any column points at it, so a failure to
   * write the row leaves an unreferenced file rather than a row pointing at
   * nothing. The caller removes it — see {@link discard} — because only the
   * caller knows whether its write succeeded.
   */
  async store(upload: LogoUpload): Promise<string> {
    this.assertAcceptable(upload);
    return this.files.save(LOGO_AREA, upload.bytes);
  }

  /**
   * Removes stored files, best effort.
   *
   * Takes `null`s so callers can hand over "the previous path, if there was
   * one" without a conditional at every call site.
   */
  async discard(paths: readonly (string | null)[]): Promise<void> {
    const present = paths.filter((path): path is string => path !== null);
    if (present.length === 0) return;
    await this.files.remove(present);
  }

  /**
   * Removes every logo file below a series, before its rows are deleted (E9).
   *
   * Called while the rows can still say which files they mean — the cascade
   * removes the events without touching the volume, so afterwards nothing knows
   * these files were ever referenced. Same reasoning and same moment as
   * `AttachmentsService.purgeForSeries`.
   */
  async purgeUnderSeries(seriesId: string): Promise<void> {
    await this.discard(await this.paths.underSeries(seriesId));
  }

  /**
   * The bytes behind one of the public logo routes.
   *
   * `null` means "there is no such image", covering three cases that are one
   * thing from the outside: the row has no logo, the volume no longer holds what
   * the row names, and the file is not an image of a type this instance serves.
   * The last two are logged, because they are an operator's problem and not the
   * caller's.
   */
  async read(storedPath: string | null): Promise<LogoBytes | null> {
    if (!storedPath) return null;

    // The third guard on E19, after the route (which takes no path from its
    // caller) and the check constraints. It is here because this is the function
    // that would do the damage: whatever ends up in those columns, the public
    // routes only ever read from the logo area.
    if (!storedPath.startsWith(`${LOGO_AREA}/`)) {
      this.logger.error(
        `A row points its logo at "${storedPath}", which is outside the logo ` +
          'area — refusing to serve it.',
      );
      return null;
    }

    const bytes = await this.files.read(storedPath);
    if (!bytes) {
      this.logger.error(
        `A logo points at "${storedPath}", which the upload volume does not hold.`,
      );
      return null;
    }

    const mimeType = signatureType(bytes, BRANDING_MIME_TYPES);
    if (!mimeType) {
      this.logger.error(
        `The logo at "${storedPath}" is not one of the image types this ` +
          'instance serves. It was checked when it was uploaded, so the file ' +
          'has changed since.',
      );
      return null;
    }

    return { mimeType, bytes };
  }

  /**
   * Everything that has to hold before a byte is written.
   *
   * The same four checks in the same order as `BrandingService`, and
   * deliberately the same limits: an organizer uploading a picture should not
   * have to learn two answers to "what may I upload here", and a second, laxer
   * set would be the one worth attacking. The wording differs only where it
   * names what the file is for.
   */
  private assertAcceptable(upload: LogoUpload): void {
    if (upload.bytes.length === 0) {
      throw new BadRequestException('The uploaded image is empty.');
    }

    if (upload.bytes.length > MAX_BRANDING_BYTES) {
      throw new PayloadTooLargeException(
        `A logo may be up to ${formatBytes(MAX_BRANDING_BYTES)}; this file is ` +
          `${formatBytes(upload.bytes.length)}. Please export it at the size ` +
          'it is displayed at.',
      );
    }

    if (!BRANDING_MIME_TYPES.includes(upload.mimeType)) {
      throw new BadRequestException(
        `A logo has to be one of: ${brandingTypeSummary()}. An SVG is not ` +
          'accepted — it can carry script, and it would be served from the ' +
          'same origin as the client that displays it.',
      );
    }

    if (!matchesSignature(upload.mimeType, upload.bytes)) {
      throw new BadRequestException(
        `This file is not ${upload.mimeType} — its content does not match the ` +
          'type it was sent as.',
      );
    }
  }
}
