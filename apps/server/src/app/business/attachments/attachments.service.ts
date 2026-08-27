import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AttachmentSummary } from '@trefaro/shared-models';
import {
  ATTACHMENT_REPOSITORY,
  type AttachmentRecord,
  type AttachmentRepository,
} from './ports/attachment.repository';
import { FILE_STORE, type FileStore } from './ports/file-store';
import type { UploadedFile } from './uploaded-file';

/** A file on its way to the organizer who asked for it. */
export interface AttachmentDownload {
  readonly fileName: string;
  readonly mimeType: string;
  readonly bytes: Buffer;
}

/**
 * The files uploaded with a registration (E9, F12, FR 3.5).
 *
 * What this service is for, in one sentence: a file has two halves — a row that says
 * what it is and bytes in the volume — and nobody outside here should have to
 * keep the two in step.
 *
 * Three rules it enforces, none of which the schema could:
 *
 * 1. **Nothing is ever served statically.** An attachment can be a passport
 *    scan; the volume is not a web root, and the only way to bytes is an
 *    administrative request through {@link download}.
 * 2. **One file per field.** Submitting the form again replaces what was
 *    uploaded before rather than piling up versions nobody asked for.
 * 3. **Files do not outlive their rows.** Every path this service deletes was
 *    read from the row that referenced it, so the volume holds exactly what the
 *    database says it holds.
 *
 * The one thing it cannot promise is atomicity: there is no transaction that
 * spans PostgreSQL and a filesystem. Where the two can disagree, this service
 * compensates in the direction that loses no data — a byte range nobody
 * references costs disk and is logged, whereas a row pointing at a file that was
 * removed costs an organizer the document they were asked to collect.
 */
@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    @Inject(ATTACHMENT_REPOSITORY)
    private readonly attachments: AttachmentRepository,
    @Inject(FILE_STORE) private readonly files: FileStore,
  ) {}

  /**
   * Stores the files of one submission, replacing what those fields held.
   *
   * Called after the registration row exists and after every check has passed:
   * a refused registration must not leave bytes behind, which is the reason
   * validation happens before anything here is called.
   */
  async store(
    registrationId: string,
    uploads: readonly UploadedFile[],
  ): Promise<void> {
    if (uploads.length === 0) return;

    const keys = new Set(uploads.map((upload) => upload.fieldKey));
    const existing = await this.attachments.findByRegistration(registrationId);
    const replaced = await this.attachments.deleteByIds(
      existing
        .filter((record) => keys.has(record.fieldKey))
        .map((record) => record.id),
    );

    const written: string[] = [];
    const created: AttachmentRecord[] = [];
    try {
      for (const upload of uploads) {
        written.push(await this.files.save(upload.bytes));
      }
      for (const [index, upload] of uploads.entries()) {
        created.push(
          await this.attachments.create({
            registrationId,
            fieldKey: upload.fieldKey,
            path: written[index],
            fileName: upload.fileName,
            mimeType: upload.mimeType,
            sizeBytes: upload.bytes.length,
          }),
        );
      }
    } catch (error: unknown) {
      // Compensation, not a rollback. What this submission wrote goes away
      // again; what an earlier submission wrote is deliberately left where it
      // is, even though its row is gone — see the note in the class comment.
      await this.attachments.deleteByIds(created.map((record) => record.id));
      await this.files.remove(written);
      this.orphaned(
        replaced,
        `storing files for registration ${registrationId} failed`,
      );
      throw error;
    }

    await this.files.remove(replaced.map((record) => record.path));
  }

  /** What the participant detail shows, in the order the fields are asked. */
  async summariesFor(
    registrationId: string,
  ): Promise<readonly AttachmentSummary[]> {
    return (await this.attachments.findByRegistration(registrationId)).map(
      toSummary,
    );
  }

  /**
   * The bytes of one attachment, for an authenticated organizer.
   *
   * A missing file answers 404 like a missing row: from the outside the two are
   * the same thing, and the difference — that the volume lost something the
   * database still lists — is a warning for the operator, not for the caller.
   */
  async download(id: string): Promise<AttachmentDownload> {
    const record = await this.attachments.findById(id);
    if (!record) throw new NotFoundException(GONE);

    const bytes = await this.files.read(record.path);
    if (!bytes) {
      this.logger.error(
        `Attachment ${record.id} points at "${record.path}", which the upload volume does not hold.`,
      );
      throw new NotFoundException(GONE);
    }

    return {
      fileName: record.fileName,
      mimeType: record.mimeType,
      bytes,
    };
  }

  /** Called before a registration is deleted — the files go with it. */
  async purgeForRegistration(registrationId: string): Promise<void> {
    await this.unlink(
      await this.attachments.deleteByRegistration(registrationId),
    );
  }

  /**
   * Called before an event is deleted.
   *
   * The database cascade would take the rows with the registrations, but a
   * cascade removes no files — so the rows are removed here, while they can
   * still say which files to unlink.
   */
  async purgeForEvent(eventId: string): Promise<void> {
    await this.unlink(await this.attachments.deleteByEvent(eventId));
  }

  /** The same for a series, whose deletion cascades through its events. */
  async purgeForSeries(seriesId: string): Promise<void> {
    await this.unlink(await this.attachments.deleteBySeries(seriesId));
  }

  private async unlink(records: readonly AttachmentRecord[]): Promise<void> {
    if (records.length === 0) return;
    await this.files.remove(records.map((record) => record.path));
  }

  private orphaned(
    records: readonly AttachmentRecord[],
    because: string,
  ): void {
    if (records.length === 0) return;
    this.logger.warn(
      `${records.length} file(s) are no longer referenced because ${because}: ` +
        `${records.map((record) => record.path).join(', ')}`,
    );
  }
}

/** Said the same way wherever an attachment cannot be found any more. */
const GONE = 'This file no longer exists.';

function toSummary(record: AttachmentRecord): AttachmentSummary {
  return {
    id: record.id,
    fieldKey: record.fieldKey,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    uploadedAt: record.createdAt.toISOString(),
  };
}
