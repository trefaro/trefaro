import { Test } from '@nestjs/testing';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FILE_STORE, type FileStore } from '../attachments/ports/file-store';
import { CatalogueService } from '../i18n';
import { README_KEYS } from './participant-readme';
import {
  PARTICIPANT_DATA_REPOSITORY,
  type ErasureRecord,
  type ParticipantDataRecord,
  type ParticipantDataRepository,
} from './ports/participant-data.repository';
import { PrivacyService } from './privacy.service';

const PROFILE: ParticipantDataRecord['profile'] = {
  id: 'p1',
  email: 'amina@example.org',
  firstName: 'Amina',
  lastName: 'Okonkwo',
  preferredLocale: 'de',
  activityAreas: null,
  customFields: {},
  searchable: false,
  avatarPath: null,
  confirmedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const EMPTY: ParticipantDataRecord = {
  profile: PROFILE,
  sessions: [],
  pushSubscriptions: [],
  registrations: [],
  programSignups: [],
  newsletterSubscriptions: [],
  conversations: [],
};

const NOTHING_ERASED: ErasureRecord = {
  files: [],
  registrationsRemoved: 0,
  conversationsLeftStanding: 0,
  newsletterSubscriptionsRemoved: 0,
};

describe('PrivacyService', () => {
  let service: PrivacyService;
  let data: jest.Mocked<ParticipantDataRepository>;
  let files: jest.Mocked<FileStore>;
  let catalogue: { resolve: jest.Mock };

  beforeEach(async () => {
    data = {
      collect: jest.fn().mockResolvedValue(EMPTY),
      erase: jest.fn().mockResolvedValue(NOTHING_ERASED),
    };
    files = {
      save: jest.fn(),
      read: jest.fn().mockResolvedValue(null),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    catalogue = {
      resolve: jest.fn().mockImplementation((locale: string) => ({
        locale,
        etag: 'x',
        catalogue: Object.fromEntries(
          README_KEYS.map((key) => [key, `${locale}:${key} {{at}}`]),
        ),
      })),
    };

    const module = await Test.createTestingModule({
      providers: [
        PrivacyService,
        { provide: PARTICIPANT_DATA_REPOSITORY, useValue: data },
        { provide: FILE_STORE, useValue: files },
        { provide: CatalogueService, useValue: catalogue },
      ],
    }).compile();

    service = module.get(PrivacyService);
  });

  describe('exportFor', () => {
    it('names the archive after the day it was made', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-18T22:30:00.000Z'));
      try {
        const archive = await service.exportFor('p1');
        expect(archive?.fileName).toBe('trefaro-export-2026-09-18.zip');
      } finally {
        jest.useRealTimers();
      }
    });

    it('writes the sentences in the language this person reads', async () => {
      const archive = await service.exportFor('p1');
      if (!archive) throw new Error('no archive');

      expect(catalogue.resolve).toHaveBeenCalledWith('de');
      expect(unpack(archive.bytes)['README.txt'].toString('utf8')).toContain(
        'de:privacy.export.readme.heading',
      );
    });

    it('reads every stored file once, even when two rows point at one path', async () => {
      data.collect.mockResolvedValue({
        ...EMPTY,
        profile: { ...PROFILE, avatarPath: 'avatars/a.png' },
      });
      files.read.mockResolvedValue(Buffer.from('bytes'));

      await service.exportFor('p1');

      expect(files.read).toHaveBeenCalledTimes(1);
      expect(files.read).toHaveBeenCalledWith('avatars/a.png');
    });

    it('answers null for an account that is no longer there', async () => {
      data.collect.mockResolvedValue(null);

      await expect(service.exportFor('p1')).resolves.toBeNull();
    });
  });

  describe('erase', () => {
    it('removes the files the erasure orphaned, after the rows are gone', async () => {
      const order: string[] = [];
      data.erase.mockImplementation(async () => {
        order.push('rows');
        return { ...NOTHING_ERASED, files: ['avatars/a.png', 'attachments/b'] };
      });
      files.remove.mockImplementation(async () => {
        order.push('files');
      });

      await service.erase('p1');

      expect(order).toEqual(['rows', 'files']);
      expect(files.remove).toHaveBeenCalledWith([
        'avatars/a.png',
        'attachments/b',
      ]);
    });

    it('does not ask the store to remove nothing', async () => {
      await service.erase('p1');

      expect(files.remove).not.toHaveBeenCalled();
    });
  });
});

/** The same independent reader the archive writer's own test uses. */
function unpack(archive: Buffer): Record<string, Buffer> {
  const dir = mkdtempSync(join(tmpdir(), 'trefaro-export-'));
  try {
    const file = join(dir, 'archive.zip');
    writeFileSync(file, archive);
    const listing = execFileSync(
      'python3',
      [
        '-c',
        'import sys, zipfile, json\n' +
          'z = zipfile.ZipFile(sys.argv[1])\n' +
          'print(json.dumps({n: z.read(n).decode("utf8", "replace") for n in z.namelist()}))',
        file,
      ],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    const parsed = JSON.parse(listing) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).map(([name, text]) => [
        name,
        Buffer.from(text, 'utf8'),
      ]),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
