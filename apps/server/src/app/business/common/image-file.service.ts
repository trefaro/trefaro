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

/** An image on its way in, in the business layer's own terms. */
export interface ImageUpload {
  /** What the request claimed — checked against the bytes, never trusted. */
  readonly mimeType: string;
  readonly bytes: Buffer;
}

/** An image on its way out to whoever asked for it. */
export interface ImageBytes {
  readonly mimeType: string;
  readonly bytes: Buffer;
}

/**
 * The subtrees of the upload volume this service may touch (E19).
 *
 * Not `FileArea`: `attachments` is deliberately absent, so no caller can hand a
 * registration attachment to a service whose whole purpose is images that get
 * served. `branding` is absent too — `BrandingService` keeps its own copy of
 * this reasoning because its paths live in one row of `app_config` and it has a
 * pair of them to keep straight.
 */
export type ImageArea = 'logos' | 'avatars';

/**
 * What each area's images are called, for the sentences a refusal is made of.
 *
 * One word per area rather than a parameter at every call site: the rules are
 * identical, only the noun differs, and an organizer uploading a picture
 * deserves a message that names what they were uploading.
 */
const NOUN: Record<ImageArea, string> = {
  logos: 'A logo',
  avatars: 'A profile picture',
};

/**
 * Stored images that get served: what may be uploaded, where it is kept, and
 * what comes back out (FR 2.1, FR 3.1, FR 4.3 — E19, F113, F124).
 *
 * The third instance of this object was the one that made it worth having. Its
 * first two — the instance's branding and the per-row logos — were written as
 * two services on the argument that what differs is *where the path is kept*,
 * and that a shared service cannot hold that part without knowing about both
 * tables. That argument still holds, and it is exactly what this class does not
 * do: nothing here reads or writes a column. What it owns is the half that has
 * nothing to do with rows, and that half was word-for-word identical the third
 * time it was needed.
 *
 * So the division is: whoever owns the row keeps the path, decides who may
 * change it and what a missing row answers; this service decides what the bytes
 * may be and which subtree they live in. `LogoImageService` is the row-side
 * half for series and events, `ProfilesService` for an avatar.
 *
 * The promises it makes are the branding ones, unchanged:
 *
 * 1. **A served image is never an attachment, in either direction.** It is
 *    written into its own area, the columns refuse a path outside it
 *    (`CHK_event_series_logo_path`, `CHK_event_logo_path`,
 *    `CHK_user_profile_avatar_path`), and {@link read} refuses one too. Three
 *    layers, because these are routes to stored bytes and E9 says the others
 *    stay shut.
 * 2. **The type is what the bytes say, not what the request said** (F38). On the
 *    way in the claim is checked against the signature; on the way out the
 *    signature alone decides the `Content-Type`, because a stored image has no
 *    name and no type column to lie in.
 * 3. **Nothing is written until everything has been checked.** A refused upload
 *    leaves the volume exactly as it was.
 *
 * What it deliberately does not do is judge the picture. E26 rules out an image
 * processing dependency, so no upload is refused for being the wrong shape — the
 * form says what is wanted and shows a preview.
 */
@Injectable()
export class ImageFileService {
  private readonly logger = new Logger(ImageFileService.name);

  constructor(@Inject(FILE_STORE) private readonly files: FileStore) {}

  /**
   * Checks an upload and writes its bytes.
   *
   * @returns the stored path, for the caller to put in its row. Deliberately
   * two steps: the file exists before any column points at it, so a failure to
   * write the row leaves an unreferenced file rather than a row pointing at
   * nothing. The caller removes it — see {@link discard} — because only the
   * caller knows whether its write succeeded.
   */
  async store(area: ImageArea, upload: ImageUpload): Promise<string> {
    this.assertAcceptable(area, upload);
    return this.files.save(area, upload.bytes);
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
   * The bytes behind one of the public media routes.
   *
   * `null` means "there is no such image", covering three cases that are one
   * thing from the outside: the row has no image, the volume no longer holds
   * what the row names, and the file is not an image of a type this instance
   * serves. The last two are logged, because they are an operator's problem and
   * not the caller's.
   */
  async read(
    area: ImageArea,
    storedPath: string | null,
  ): Promise<ImageBytes | null> {
    if (!storedPath) return null;

    // The third guard on E19, after the route (which takes no path from its
    // caller) and the check constraints. It is here because this is the
    // function that would do the damage: whatever ends up in those columns, a
    // media route only ever reads from its own area.
    if (!storedPath.startsWith(`${area}/`)) {
      this.logger.error(
        `A row points an image at "${storedPath}", which is outside the ` +
          `${area} area — refusing to serve it.`,
      );
      return null;
    }

    const bytes = await this.files.read(storedPath);
    if (!bytes) {
      this.logger.error(
        `An image points at "${storedPath}", which the upload volume does not hold.`,
      );
      return null;
    }

    const mimeType = signatureType(bytes, BRANDING_MIME_TYPES);
    if (!mimeType) {
      this.logger.error(
        `The image at "${storedPath}" is not one of the types this instance ` +
          'serves. It was checked when it was uploaded, so the file has ' +
          'changed since.',
      );
      return null;
    }

    return { mimeType, bytes };
  }

  /**
   * Everything that has to hold before a byte is written.
   *
   * The same four checks in the same order for every served image, and
   * deliberately the same limits: somebody uploading a picture should not have
   * to learn two answers to "what may I upload here", and a second, laxer set
   * would be the one worth attacking.
   */
  private assertAcceptable(area: ImageArea, upload: ImageUpload): void {
    const noun = NOUN[area];

    if (upload.bytes.length === 0) {
      throw new BadRequestException('The uploaded image is empty.');
    }

    if (upload.bytes.length > MAX_BRANDING_BYTES) {
      throw new PayloadTooLargeException(
        `${noun} may be up to ${formatBytes(MAX_BRANDING_BYTES)}; this file ` +
          `is ${formatBytes(upload.bytes.length)}. Please export it at the ` +
          'size it is displayed at.',
      );
    }

    if (!BRANDING_MIME_TYPES.includes(upload.mimeType)) {
      throw new BadRequestException(
        `${noun} has to be one of: ${brandingTypeSummary()}. An SVG is not ` +
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
