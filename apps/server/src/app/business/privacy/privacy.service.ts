import { Inject, Injectable, Logger } from '@nestjs/common';
import { FILE_STORE, type FileStore } from '../attachments/ports/file-store';
import { zipArchive } from '../common/zip-archive';
import { CatalogueService } from '../i18n';
import { participantArchive } from './participant-archive';
import { participantReadme } from './participant-readme';
import {
  PARTICIPANT_DATA_REPOSITORY,
  type ParticipantDataRecord,
  type ParticipantDataRepository,
} from './ports/participant-data.repository';

/** A finished archive: what to call it and what is in it. */
export interface ParticipantArchiveFile {
  readonly fileName: string;
  readonly bytes: Buffer;
}

/**
 * The two things a person may ask of their own data (E65).
 *
 * **Export and erasure are one subject, not two features.** They answer the
 * same question from opposite ends — what does this instance hold about me —
 * and they have to agree: a table the export forgets is a table the erasure
 * forgets too, and neither omission is visible from the outside. That is why
 * they share one port and why that port has one implementation.
 *
 * Deliberately **not** on `ProfilesService`: an export reads registrations,
 * conversations, consents and files, none of which are the account module's,
 * and a method there would have had to import half the business layer to
 * assemble them.
 */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    @Inject(PARTICIPANT_DATA_REPOSITORY)
    private readonly data: ParticipantDataRepository,
    @Inject(FILE_STORE) private readonly files: FileStore,
    private readonly catalogue: CatalogueService,
  ) {}

  /**
   * Everything stored about one person, as one archive.
   *
   * The whole thing is built in memory, which is the same bound every other
   * file route in this application works under: what an archive can hold is
   * one person's uploads, each already capped by `MAX_UPLOAD_BYTES`, and a
   * person who registered for forty events is the outlier this instance was
   * never sized for anyway. A stream would buy that outlier at the price of a
   * half-written download for everybody else.
   *
   * @returns `null` when the account is gone — a session can outlive its
   * profile by the width of a request, and that is a 404, not a crash.
   */
  async exportFor(profileId: string): Promise<ParticipantArchiveFile | null> {
    const record = await this.data.collect(profileId);
    if (!record) return null;

    const at = new Date();
    const [bytes, readme] = await Promise.all([
      this.bytesOf(record),
      this.readmeFor(record, at),
    ]);

    return {
      fileName: `trefaro-export-${at.toISOString().slice(0, 10)}.zip`,
      bytes: zipArchive(participantArchive(record, bytes, readme, at), at),
    };
  }

  /**
   * Erases one account (E65).
   *
   * The rows go in one transaction and the files afterwards, in that order and
   * never the other way round: a file whose row is gone is a leftover an
   * operator can find and remove, while a row whose file is gone is a download
   * that breaks for the organizer who needed it.
   */
  async erase(profileId: string): Promise<void> {
    const erased = await this.data.erase(profileId);
    if (erased.files.length > 0) await this.files.remove(erased.files);

    // The only record that this ran: afterwards there is nothing left to look
    // at, and an operator asked whether an erasure happened has nowhere else
    // to look. No address in the line — that is the thing being erased.
    this.logger.log(
      `Erased participant account ${profileId}: ` +
        `${erased.registrationsRemoved} registration(s) removed, ` +
        `${erased.conversationsLeftStanding} conversation(s) left standing, ` +
        `${erased.newsletterSubscriptionsRemoved} newsletter consent(s) removed, ` +
        `${erased.files.length} file(s) removed`,
    );
  }

  /** Every stored file the archive needs, read once per path. */
  private async bytesOf(
    record: ParticipantDataRecord,
  ): Promise<ReadonlyMap<string, Buffer>> {
    const paths = new Set<string>();
    if (record.profile.avatarPath) paths.add(record.profile.avatarPath);
    for (const registration of record.registrations) {
      for (const file of registration.files) paths.add(file.path);
    }
    for (const conversation of record.conversations) {
      for (const message of conversation.messages) {
        if (message.mine && message.file) paths.add(message.file.path);
      }
    }

    const found = new Map<string, Buffer>();
    for (const path of paths) {
      const bytes = await this.files.read(path);
      // A path the store no longer holds is not an error: the archive says so
      // in the JSON, which is more than a failed download would.
      if (bytes) found.set(path, bytes);
    }
    return found;
  }

  private async readmeFor(
    record: ParticipantDataRecord,
    at: Date,
  ): Promise<string> {
    const resolved = await this.catalogue.resolve(
      record.profile.preferredLocale,
    );
    return participantReadme(resolved.catalogue, {
      at: at.toISOString(),
      name: `${record.profile.firstName} ${record.profile.lastName}`.trim(),
    });
  }
}
