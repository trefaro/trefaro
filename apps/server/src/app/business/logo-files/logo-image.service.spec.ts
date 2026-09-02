import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { MAX_BRANDING_BYTES } from '@trefaro/shared-models';
import {
  typesWithoutSignature,
  type FileArea,
  type FileStore,
} from '../attachments';
import { ImageFileService } from '../common/image-file.service';
import { LogoImageService } from './logo-image.service';
import type { LogoPathsRepository } from './ports/logo-paths.repository';

/** The upload volume as a map, with the layout the real store produces. */
class FakeFileStore implements FileStore {
  readonly files = new Map<string, Buffer>();
  readonly removed: string[] = [];
  readonly areas: FileArea[] = [];
  private next = 1;

  async save(area: FileArea, bytes: Buffer): Promise<string> {
    this.areas.push(area);
    const path = `${area}/file-${this.next++}`;
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

class FakeLogoPaths implements LogoPathsRepository {
  paths: string[] = [];

  async underSeries(): Promise<readonly string[]> {
    return this.paths;
  }
}

/** Real headers, so the signature check decides the same way it does in production. */
const png = (padding = 16): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(padding),
  ]);

const jpeg = (): Buffer =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(16)]);

describe('LogoImageService', () => {
  let files: FakeFileStore;
  let paths: FakeLogoPaths;
  let service: LogoImageService;

  beforeEach(() => {
    files = new FakeFileStore();
    paths = new FakeLogoPaths();
    // The real shared service on a fake volume: what this file asserts is that
    // a logo goes into the logo area and comes back out of it, and delegating
    // to a stub would assert only that a method was called.
    service = new LogoImageService(new ImageFileService(files), paths);
  });

  describe('store', () => {
    it('writes into the logo area and nowhere else (E19)', async () => {
      const stored = await service.store({
        mimeType: 'image/png',
        bytes: png(),
      });

      // The subtree is the promise: attachments may be passport scans and are
      // only reachable through an authenticated download, while these bytes are
      // handed to anonymous visitors. Two areas is how an operator can tell
      // which is which with `ls`.
      expect(files.areas).toEqual(['logos']);
      expect(stored).toMatch(/^logos\//);
    });

    it('refuses an empty file', async () => {
      await expect(
        service.store({ mimeType: 'image/png', bytes: Buffer.alloc(0) }),
      ).rejects.toThrow(BadRequestException);

      expect(files.files.size).toBe(0);
    });

    it('refuses an image above the ceiling', async () => {
      await expect(
        service.store({
          mimeType: 'image/png',
          bytes: png(MAX_BRANDING_BYTES + 1),
        }),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('refuses an SVG, whatever it is called', async () => {
      // Not taste: an SVG is a document that may carry script, and it would be
      // served from the origin of the client that displays it.
      await expect(
        service.store({
          mimeType: 'image/svg+xml',
          bytes: Buffer.from('<svg onload="alert(1)"/>'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a file whose bytes disagree with its declared type (F38)', async () => {
      await expect(
        service.store({ mimeType: 'image/png', bytes: jpeg() }),
      ).rejects.toThrow(BadRequestException);

      expect(files.files.size).toBe(0);
    });

    it('accepts every type the catalogue promises', () => {
      // The other half of F38: a type nobody can check is a type whose name is
      // a claim. If this ever fails, a type was added to the catalogue without
      // a signature next to it.
      expect(typesWithoutSignature()).toEqual([]);
    });
  });

  describe('read', () => {
    it('answers the type the bytes say, not the one that was claimed', async () => {
      const stored = await service.store({
        mimeType: 'image/png',
        bytes: png(),
      });

      const image = await service.read(stored);

      expect(image?.mimeType).toBe('image/png');
    });

    it('answers nothing for a row without a logo', async () => {
      expect(await service.read(null)).toBeNull();
    });

    it('refuses a path outside the logo area, whatever wrote it', async () => {
      files.files.set('attachments/xx/passport', png());

      // The third guard on E19, after the route (which takes no path from its
      // caller) and the check constraints. This is the function that would do
      // the damage, so it says no here too.
      expect(await service.read('attachments/xx/passport')).toBeNull();
    });

    it('answers nothing when the volume no longer holds the file', async () => {
      expect(await service.read('logos/file-404')).toBeNull();
    });

    it('answers nothing when the stored file is no longer an image', async () => {
      files.files.set('logos/file-1', Buffer.from('not an image at all'));

      expect(await service.read('logos/file-1')).toBeNull();
    });
  });

  describe('discard and purge', () => {
    it('ignores the nulls a caller passes for "there was none"', async () => {
      await service.discard([null, null]);

      expect(files.removed).toEqual([]);
    });

    it('removes every logo file below a series (E9)', async () => {
      paths.paths = ['logos/file-1', 'logos/file-2'];

      await service.purgeUnderSeries('series-1');

      // Collected while the rows can still say them: the cascade takes the
      // events without touching the volume.
      expect(files.removed).toEqual(['logos/file-1', 'logos/file-2']);
    });
  });
});
