import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { MAX_BRANDING_BYTES } from '@trefaro/shared-models';
import type { FileArea, FileStore } from '../attachments';
import { ImageFileService } from './image-file.service';

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

/** Real headers, so the signature check decides as it does in production. */
const png = (padding = 16): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(padding),
  ]);

const jpeg = (): Buffer =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(16)]);

/**
 * The shared half of every stored image that gets served (E19, F113, F124).
 *
 * `logo-image.service.spec.ts` already walks these checks through the logo side
 * of the split; what this file is for is the property that made the split worth
 * making — the rules do not depend on which area the image is for, and the two
 * areas cannot be confused with one another.
 */
describe('ImageFileService', () => {
  let files: FakeFileStore;
  let service: ImageFileService;

  beforeEach(() => {
    files = new FakeFileStore();
    service = new ImageFileService(files);
  });

  describe.each(['logos', 'avatars'] as const)('the %s area', (area) => {
    it('writes into its own subtree and nowhere else', async () => {
      const stored = await service.store(area, {
        mimeType: 'image/png',
        bytes: png(),
      });

      expect(files.areas).toEqual([area]);
      expect(stored).toMatch(new RegExp(`^${area}/`));
    });

    it('applies the same four checks as every other area', async () => {
      await expect(
        service.store(area, { mimeType: 'image/png', bytes: Buffer.alloc(0) }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.store(area, {
          mimeType: 'image/png',
          bytes: png(MAX_BRANDING_BYTES + 1),
        }),
      ).rejects.toThrow(PayloadTooLargeException);

      await expect(
        service.store(area, {
          mimeType: 'image/svg+xml',
          bytes: Buffer.from('<svg onload="alert(1)"/>'),
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.store(area, { mimeType: 'image/png', bytes: jpeg() }),
      ).rejects.toThrow(BadRequestException);

      // Not one byte written by any of the four.
      expect(files.files.size).toBe(0);
    });

    it('answers the type the bytes say, not the one that was claimed (F38)', async () => {
      const stored = await service.store(area, {
        mimeType: 'image/png',
        bytes: png(),
      });

      expect(await service.read(area, stored)).toMatchObject({
        mimeType: 'image/png',
      });
    });

    it('refuses to read outside its own area, whatever wrote the path', async () => {
      files.files.set('attachments/xx/passport', png());

      // The third guard on E19, after the route (which takes no path from its
      // caller) and the check constraints.
      expect(await service.read(area, 'attachments/xx/passport')).toBeNull();
    });
  });

  it('will not serve a logo through the avatar area, or the other way round', async () => {
    const logo = await service.store('logos', {
      mimeType: 'image/png',
      bytes: png(),
    });
    const avatar = await service.store('avatars', {
      mimeType: 'image/png',
      bytes: png(32),
    });

    // The whole reason `avatars/` is a subtree of its own: a logo is a brand
    // and an avatar is a picture of a person, and no route may be talked into
    // reading the other kind.
    expect(await service.read('avatars', logo)).toBeNull();
    expect(await service.read('logos', avatar)).toBeNull();
  });

  it('names what was being uploaded when it refuses one', async () => {
    // One rule, two nouns: somebody uploading a picture of themselves should
    // not read a sentence about logos.
    await expect(
      service.store('avatars', {
        mimeType: 'image/gif',
        bytes: Buffer.from('GIF89a'),
      }),
    ).rejects.toThrow(/A profile picture has to be one of/);

    await expect(
      service.store('logos', {
        mimeType: 'image/gif',
        bytes: Buffer.from('GIF89a'),
      }),
    ).rejects.toThrow(/A logo has to be one of/);
  });

  it('ignores the nulls a caller passes for "there was none"', async () => {
    await service.discard([null, null]);

    expect(files.removed).toEqual([]);
  });

  it('answers nothing for a row without an image, and for a file that is gone', async () => {
    expect(await service.read('avatars', null)).toBeNull();
    expect(await service.read('avatars', 'avatars/file-404')).toBeNull();

    files.files.set('avatars/file-1', Buffer.from('not an image at all'));
    expect(await service.read('avatars', 'avatars/file-1')).toBeNull();
  });
});
