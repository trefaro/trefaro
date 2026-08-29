import {
  BRANDING_MIME_TYPES,
  MAX_BRANDING_BYTES,
  type AppConfigChange,
  type BrandingImageKind,
} from '@trefaro/shared-models';
import {
  typesWithoutSignature,
  type FileArea,
  type FileStore,
} from '../attachments';
import { BrandingService } from './branding.service';
import type {
  AppConfigRecord,
  AppConfigRepository,
} from './ports/app-config.repository';

const CHANGED_AT = new Date('2026-08-28T09:41:00.000Z');

const storedConfig: AppConfigRecord = {
  organizationName: 'Democracy International e.V.',
  primaryColor: '#1f6f5c',
  accentColor: '#e8a33d',
  logoPath: null,
  appIconPath: null,
  fontFamily: 'system-ui',
  defaultLocale: 'en',
  availableLocales: ['en'],
  updatedAt: CHANGED_AT,
};

class FakeAppConfigRepository implements AppConfigRepository {
  record: AppConfigRecord;

  constructor(record: AppConfigRecord = storedConfig) {
    this.record = record;
  }

  async load(): Promise<AppConfigRecord> {
    return this.record;
  }

  async save(change: AppConfigChange): Promise<AppConfigRecord> {
    this.record = { ...this.record, ...change };
    return this.record;
  }

  async setBrandingImage(
    kind: BrandingImageKind,
    storedPath: string | null,
  ): Promise<AppConfigRecord> {
    this.record =
      kind === 'logo'
        ? { ...this.record, logoPath: storedPath }
        : { ...this.record, appIconPath: storedPath };
    return this.record;
  }

  async setLocales(locales: {
    readonly defaultLocale: string;
    readonly activeLocales: readonly string[];
  }): Promise<AppConfigRecord> {
    this.record = {
      ...this.record,
      defaultLocale: locales.defaultLocale,
      availableLocales: locales.activeLocales,
    };
    return this.record;
  }
}

/** The upload volume as a map, with the layout the real store produces. */
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

/** Real headers, so the signature check decides the same way it does in production. */
const png = (padding = 16): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(padding),
  ]);

const jpeg = (): Buffer =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(16)]);

const webp = (): Buffer =>
  Buffer.concat([
    Buffer.from('RIFF', 'latin1'),
    Buffer.alloc(4),
    Buffer.from('WEBP', 'latin1'),
    Buffer.alloc(16),
  ]);

/** A PNG whose IHDR chunk actually declares a size (AP 12). */
const measurablePng = (width: number, height: number): Buffer => {
  const bytes = Buffer.alloc(24);
  png(16).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'latin1');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
};

/** A zip archive's local file header — what a `.docx` and a `.zip` start with. */
const zip = (): Buffer =>
  Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(16)]);

describe('BrandingService', () => {
  let appConfig: FakeAppConfigRepository;
  let files: FakeFileStore;
  let service: BrandingService;

  beforeEach(() => {
    appConfig = new FakeAppConfigRepository();
    files = new FakeFileStore();
    service = new BrandingService(appConfig, files);
  });

  it('has a signature for every type it accepts (F38)', () => {
    // The same rule the registration catalogue lives by: a type nobody can
    // recognize from its first bytes is a type whose name is only a claim. A new
    // entry in `BRANDING_TYPES` fails here until `file-signature.ts` knows it.
    expect(typesWithoutSignature(BRANDING_MIME_TYPES)).toEqual([]);
  });

  describe('replace', () => {
    it('stores the image in the branding area and points the row at it', async () => {
      const urls = await service.replace('logo', {
        mimeType: 'image/png',
        bytes: png(),
      });

      // The area is the property E19 rests on: whatever the public route ends up
      // reading, it reads from a subtree that holds no attachments.
      expect(appConfig.record.logoPath).toMatch(/^branding\//);
      expect(urls.logoUrl).toBe(
        `/api/media/branding/logo?v=${CHANGED_AT.getTime()}`,
      );
      expect(urls.appIconUrl).toBeNull();
    });

    it('keeps the two images apart', async () => {
      await service.replace('logo', { mimeType: 'image/png', bytes: png() });
      const urls = await service.replace('app-icon', {
        mimeType: 'image/webp',
        bytes: webp(),
      });

      expect(appConfig.record.logoPath).not.toBe(appConfig.record.appIconPath);
      expect(urls.logoUrl).not.toBeNull();
      expect(urls.appIconUrl).not.toBeNull();
      expect(files.files.size).toBe(2);
    });

    it('removes the image it replaces', async () => {
      await service.replace('logo', { mimeType: 'image/png', bytes: png() });
      const first = appConfig.record.logoPath;

      await service.replace('logo', { mimeType: 'image/jpeg', bytes: jpeg() });

      // At most one logo exists at a time, so a leftover file would never be
      // noticed again — unlike an attachment, which a row still names.
      expect(files.removed).toEqual([first]);
      expect(files.files.size).toBe(1);
    });

    it('refuses a type that may not be a brand, and writes nothing', async () => {
      await expect(
        service.replace('logo', {
          mimeType: 'application/pdf',
          bytes: Buffer.from('%PDF-1.7\n', 'latin1'),
        }),
      ).rejects.toMatchObject({ status: 400 });

      expect(files.files.size).toBe(0);
      expect(appConfig.record.logoPath).toBeNull();
    });

    it('refuses an SVG, whatever it is called', async () => {
      // Not a taste question: an SVG can carry script, and it would be served
      // from the same origin as the client that displays it.
      await expect(
        service.replace('logo', {
          mimeType: 'image/svg+xml',
          bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        }),
      ).rejects.toMatchObject({ status: 400 });

      expect(files.files.size).toBe(0);
    });

    it('refuses bytes that are not the type they were sent as (F38)', async () => {
      await expect(
        service.replace('logo', { mimeType: 'image/png', bytes: zip() }),
      ).rejects.toMatchObject({ status: 400 });

      expect(files.files.size).toBe(0);
      expect(appConfig.record.logoPath).toBeNull();
    });

    it('refuses an empty file', async () => {
      await expect(
        service.replace('logo', {
          mimeType: 'image/png',
          bytes: Buffer.alloc(0),
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('refuses an image above the ceiling, with 413', async () => {
      await expect(
        service.replace('logo', {
          mimeType: 'image/png',
          bytes: png(MAX_BRANDING_BYTES),
        }),
      ).rejects.toMatchObject({ status: 413 });

      // Checked here as well as in the multipart parser: a seed script or a
      // later import reaches this service without passing a controller.
      expect(files.files.size).toBe(0);
    });
  });

  describe('remove', () => {
    it('clears the row and unlinks the file', async () => {
      await service.replace('app-icon', {
        mimeType: 'image/png',
        bytes: png(),
      });
      const stored = appConfig.record.appIconPath;

      const urls = await service.remove('app-icon');

      expect(urls.appIconUrl).toBeNull();
      expect(appConfig.record.appIconPath).toBeNull();
      expect(files.removed).toEqual([stored]);
    });

    it('is a no-op when nothing is uploaded', async () => {
      const urls = await service.remove('logo');

      expect(urls.logoUrl).toBeNull();
      expect(files.removed).toEqual([]);
    });
  });

  describe('read', () => {
    it('answers with the type the bytes say, not with a stored one', async () => {
      await service.replace('logo', { mimeType: 'image/webp', bytes: webp() });

      // Nothing about the stored file records its type: no extension, no column.
      // What it is gets decided the same way on the way out as on the way in.
      expect(await service.read('logo')).toEqual({
        mimeType: 'image/webp',
        bytes: webp(),
      });
    });

    it('answers nothing while no image is uploaded', async () => {
      expect(await service.read('logo')).toBeNull();
      expect(await service.read('app-icon')).toBeNull();
    });

    it('refuses to serve a path outside the branding area (E19)', async () => {
      // The state this guards against cannot be reached through the API — the
      // column has a check constraint and the route takes no path. It is the
      // layer that still holds if a row is ever written by something else, and
      // the file it would hand out is a passport scan (E9).
      const attachment = 'attachments/xx/file-1';
      files.files.set(attachment, png());
      appConfig.record = { ...storedConfig, logoPath: attachment };

      expect(await service.read('logo')).toBeNull();
    });

    it('answers nothing when the volume lost the file', async () => {
      await service.replace('logo', { mimeType: 'image/png', bytes: png() });
      files.files.clear();

      // Logged for the operator, a 404 for the caller: from the outside "no
      // logo" and "the volume lost the logo" are the same thing.
      expect(await service.read('logo')).toBeNull();
    });

    it('answers nothing when the stored bytes are no longer an image', async () => {
      await service.replace('logo', { mimeType: 'image/png', bytes: png() });
      const path = appConfig.record.logoPath ?? '';
      files.files.set(path, zip());

      expect(await service.read('logo')).toBeNull();
    });
  });

  describe('describe', () => {
    it('reads the size out of the header the PWA manifest needs it from', async () => {
      await service.replace('app-icon', {
        mimeType: 'image/png',
        bytes: measurablePng(512, 512),
      });

      expect(await service.describe('app-icon')).toEqual({
        mimeType: 'image/png',
        dimensions: { width: 512, height: 512 },
      });
    });

    it('says so when the header does not state a size', async () => {
      // Not an error and not a refusal: the manifest has a rule for it that
      // keeps the instance installable (F20).
      await service.replace('app-icon', {
        mimeType: 'image/png',
        bytes: png(),
      });

      expect(await service.describe('app-icon')).toEqual({
        mimeType: 'image/png',
        dimensions: null,
      });
    });

    it('inherits every guard of read', async () => {
      expect(await service.describe('app-icon')).toBeNull();

      await service.replace('app-icon', {
        mimeType: 'image/png',
        bytes: measurablePng(192, 192),
      });
      files.files.delete(appConfig.record.appIconPath ?? '');

      expect(await service.describe('app-icon')).toBeNull();
    });
  });
});
