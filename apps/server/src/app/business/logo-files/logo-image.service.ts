import { Inject, Injectable } from '@nestjs/common';
import {
  ImageFileService,
  type ImageBytes,
  type ImageUpload,
} from '../common/image-file.service';
import {
  LOGO_PATHS_REPOSITORY,
  type LogoPathsRepository,
} from './ports/logo-paths.repository';

/** An image on its way in — the shared shape, named for its one use here. */
export type LogoUpload = ImageUpload;

/** An image on its way out to an anonymous visitor. */
export type LogoBytes = ImageBytes;

/** The subtree of the upload volume row logos live in (E19). */
const LOGO_AREA = 'logos';

/**
 * The bytes of a series or event logo (FR 2.1, FR 3.1).
 *
 * What is left of this class after AP 2 of phase 3 is the part that is about
 * logos rather than about images: the area they live in, and the one query that
 * nothing else has — which files hang below a series that is about to be
 * deleted. The checks, the write and the read moved to
 * {@link ImageFileService} when the profile pictures of FR 4.3 turned out to
 * need the same three functions word for word.
 *
 * `EventSeriesService` and `EventsService` still own the other half — which row
 * a logo belongs to, who may change it, and what a missing row answers — and
 * they each keep their own 404 rule rather than delegating it here.
 *
 * What it deliberately does not do is judge the picture. E26 rules out an image
 * processing dependency, so no upload is refused for being the wrong shape — the
 * form says what is wanted and shows a preview.
 */
@Injectable()
export class LogoImageService {
  constructor(
    private readonly images: ImageFileService,
    @Inject(LOGO_PATHS_REPOSITORY) private readonly paths: LogoPathsRepository,
  ) {}

  /**
   * Checks an upload and writes its bytes.
   *
   * @returns the stored path, for the caller to put in its row. Two steps on
   * purpose — the argument is with {@link ImageFileService.store}.
   */
  store(upload: LogoUpload): Promise<string> {
    return this.images.store(LOGO_AREA, upload);
  }

  /** Removes stored files, best effort; takes `null`s for "if there was one". */
  discard(paths: readonly (string | null)[]): Promise<void> {
    return this.images.discard(paths);
  }

  /**
   * Removes every logo file below a series, before its rows are deleted (E9).
   *
   * Called while the rows can still say which files they mean — the cascade
   * removes the events without touching the volume, so afterwards nothing knows
   * these files were ever referenced. Same reasoning and same moment as
   * `AttachmentsService.purgeForSeries`.
   *
   * The one method of this class that reads a table, and the reason it is a
   * class and not three re-exported functions.
   */
  async purgeUnderSeries(seriesId: string): Promise<void> {
    await this.discard(await this.paths.underSeries(seriesId));
  }

  /**
   * The bytes behind one of the public logo routes.
   *
   * `null` means "there is no such image" — the three cases it covers are
   * listed at {@link ImageFileService.read}.
   */
  read(storedPath: string | null): Promise<LogoBytes | null> {
    return this.images.read(LOGO_AREA, storedPath);
  }
}
