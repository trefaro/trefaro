import { NotFoundException } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import type {
  AttachmentRecord,
  AttachmentRepository,
  NewAttachment,
} from './ports/attachment.repository';
import type { FileArea, FileStore } from './ports/file-store';
import type { UploadedFile } from './uploaded-file';

const CREATED_AT = new Date('2026-08-24T09:30:00.000Z');

/** In-memory attachments, with the unique index the table has (E9). */
class FakeAttachmentRepository implements AttachmentRepository {
  rows: AttachmentRecord[] = [];
  /** Set to make the next `create` fail the way a full disk or a race would. */
  failing = false;
  private nextId = 1;

  async findById(id: string): Promise<AttachmentRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findByRegistration(
    registrationId: string,
  ): Promise<readonly AttachmentRecord[]> {
    return this.rows.filter((row) => row.registrationId === registrationId);
  }

  async create(attachment: NewAttachment): Promise<AttachmentRecord> {
    if (this.failing) throw new Error('the volume is full');
    if (
      this.rows.some(
        (row) =>
          row.registrationId === attachment.registrationId &&
          row.fieldKey === attachment.fieldKey,
      )
    ) {
      throw new Error('one file per field');
    }
    const created: AttachmentRecord = {
      id: `attachment-${this.nextId++}`,
      createdAt: CREATED_AT,
      ...attachment,
    };
    this.rows.push(created);
    return created;
  }

  async deleteByIds(
    ids: readonly string[],
  ): Promise<readonly AttachmentRecord[]> {
    return this.remove((row) => ids.includes(row.id));
  }

  async deleteByRegistration(
    registrationId: string,
  ): Promise<readonly AttachmentRecord[]> {
    return this.remove((row) => row.registrationId === registrationId);
  }

  async deleteByEvent(eventId: string): Promise<readonly AttachmentRecord[]> {
    // The fake keeps no events; the service only forwards the id.
    return this.remove((row) => row.registrationId === eventId);
  }

  async deleteBySeries(seriesId: string): Promise<readonly AttachmentRecord[]> {
    return this.remove((row) => row.registrationId === seriesId);
  }

  private remove(
    matches: (row: AttachmentRecord) => boolean,
  ): readonly AttachmentRecord[] {
    const removed = this.rows.filter(matches);
    this.rows = this.rows.filter((row) => !matches(row));
    return removed;
  }
}

/** The upload volume as a map, which is all the service needs it to be. */
class FakeFileStore implements FileStore {
  readonly files = new Map<string, Buffer>();
  readonly removed: string[] = [];
  private next = 1;

  async save(area: FileArea, bytes: Buffer): Promise<string> {
    const path =
      area === 'attachments'
        ? `attachments/xx/file-${this.next++}`
        : `${area}/file-${this.next++}`;
    this.files.set(path, bytes);
    return path;
  }

  async read(path: string): Promise<Buffer | null> {
    return this.files.get(path) ?? null;
  }

  async remove(paths: readonly string[]): Promise<void> {
    for (const path of paths) {
      this.removed.push(path);
      this.files.delete(path);
    }
  }
}

const upload = (
  fieldKey: string,
  overrides: Partial<UploadedFile> = {},
): UploadedFile => ({
  fieldKey,
  fileName: 'passport.pdf',
  mimeType: 'application/pdf',
  bytes: Buffer.from('%PDF-1.7 first'),
  ...overrides,
});

describe('AttachmentsService', () => {
  let repository: FakeAttachmentRepository;
  let store: FakeFileStore;
  let service: AttachmentsService;

  beforeEach(() => {
    repository = new FakeAttachmentRepository();
    store = new FakeFileStore();
    service = new AttachmentsService(repository, store);
  });

  describe('store', () => {
    it('writes the bytes and a row that describes them', async () => {
      await service.store('registration-1', [upload('passport')]);

      const [row] = repository.rows;
      expect(row.fieldKey).toBe('passport');
      expect(row.fileName).toBe('passport.pdf');
      expect(row.sizeBytes).toBe(14);
      expect(store.files.get(row.path)).toEqual(Buffer.from('%PDF-1.7 first'));
    });

    it('replaces what the same field held, and unlinks the old bytes', async () => {
      await service.store('registration-1', [upload('passport')]);
      const first = repository.rows[0].path;

      await service.store('registration-1', [
        upload('passport', {
          fileName: 'corrected.pdf',
          bytes: Buffer.from('%PDF-1.7 second'),
        }),
      ]);

      // One file per field: a corrected upload is a correction, not a version.
      expect(repository.rows).toHaveLength(1);
      expect(repository.rows[0].fileName).toBe('corrected.pdf');
      expect(store.removed).toEqual([first]);
      expect(store.files.has(first)).toBe(false);
    });

    it('leaves the files of other fields alone', async () => {
      await service.store('registration-1', [
        upload('passport'),
        upload('proof-of-payment'),
      ]);

      await service.store('registration-1', [upload('passport')]);

      expect(repository.rows.map((row) => row.fieldKey).sort()).toEqual([
        'passport',
        'proof-of-payment',
      ]);
    });

    it('leaves no bytes behind when the row cannot be written', async () => {
      repository.failing = true;

      await expect(
        service.store('registration-1', [upload('passport')]),
      ).rejects.toThrow('the volume is full');

      // No transaction spans a filesystem and a database, so the compensation
      // has to be explicit — and it has to run in this direction.
      expect(store.files.size).toBe(0);
      expect(repository.rows).toHaveLength(0);
    });

    it('does nothing at all when there is nothing to store', async () => {
      await service.store('registration-1', []);

      expect(store.files.size).toBe(0);
      expect(repository.rows).toHaveLength(0);
    });
  });

  describe('download', () => {
    it('answers with the bytes under the name they were uploaded with', async () => {
      await service.store('registration-1', [upload('passport')]);

      const file = await service.download(repository.rows[0].id);

      expect(file.fileName).toBe('passport.pdf');
      expect(file.mimeType).toBe('application/pdf');
      expect(file.bytes).toEqual(Buffer.from('%PDF-1.7 first'));
    });

    it('answers 404 for an id nothing matches', async () => {
      await expect(service.download('attachment-404')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('answers 404 when the volume no longer holds the file', async () => {
      await service.store('registration-1', [upload('passport')]);
      store.files.clear();

      // From the outside the two are the same thing; the difference is a
      // warning for whoever runs the instance.
      await expect(service.download(repository.rows[0].id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('summariesFor', () => {
    it('says what a list needs and nothing about where the bytes are', async () => {
      await service.store('registration-1', [upload('passport')]);

      const [summary] = await service.summariesFor('registration-1');

      expect(summary).toEqual({
        id: 'attachment-1',
        fieldKey: 'passport',
        fileName: 'passport.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 14,
        uploadedAt: '2026-08-24T09:30:00.000Z',
      });
      // The path is deliberately not in it: the only way to the bytes is the
      // administrative download endpoint (E9).
      expect(Object.keys(summary)).not.toContain('path');
    });
  });

  describe('purge', () => {
    it('removes the rows and the bytes of one registration', async () => {
      await service.store('registration-1', [
        upload('passport'),
        upload('proof-of-payment'),
      ]);
      await service.store('registration-2', [upload('passport')]);

      await service.purgeForRegistration('registration-1');

      expect(repository.rows.map((row) => row.registrationId)).toEqual([
        'registration-2',
      ]);
      expect(store.files.size).toBe(1);
    });

    it('asks the same of an event and of a series', async () => {
      // The fake matches on the id it is given; what matters here is that both
      // paths unlink what they removed rather than only deleting rows.
      await service.store('event-1', [upload('passport')]);
      await service.purgeForEvent('event-1');
      expect(store.files.size).toBe(0);

      await service.store('series-1', [upload('passport')]);
      await service.purgeForSeries('series-1');
      expect(store.files.size).toBe(0);
      expect(repository.rows).toHaveLength(0);
    });
  });
});
