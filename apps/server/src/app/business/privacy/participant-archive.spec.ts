import { zipArchive } from '../common/zip-archive';
import { participantArchive } from './participant-archive';
import type { ParticipantDataRecord } from './ports/participant-data.repository';

const at = new Date('2026-09-18T10:00:00.000Z');
const README = 'Was in diesem Archiv steht.';

function record(
  over: Partial<ParticipantDataRecord> = {},
): ParticipantDataRecord {
  return {
    profile: {
      id: 'p1',
      email: 'Amina@Example.org',
      firstName: 'Amina',
      lastName: 'Okonkwo',
      preferredLocale: 'de',
      activityAreas: 'Klima',
      customFields: { 'local-group': 'Bonn' },
      searchable: true,
      avatarPath: 'avatars/abc',
      confirmedAt: new Date('2026-01-02T03:04:05.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    },
    sessions: [],
    pushSubscriptions: [],
    registrations: [],
    programSignups: [],
    newsletterSubscriptions: [],
    conversations: [],
    ...over,
  };
}

function json(archive: ReturnType<typeof participantArchive>) {
  const entry = archive.find((one) => one.path === 'export.json');
  if (!entry) throw new Error('no export.json');
  return JSON.parse(entry.bytes.toString('utf8'));
}

describe('participantArchive', () => {
  it('always writes the JSON, even for an account with nothing else', () => {
    const archive = participantArchive(record(), new Map(), README, at);

    expect(archive.map((one) => one.path)).toEqual([
      'README.txt',
      'export.json',
    ]);
    expect(json(archive).account.email).toBe('Amina@Example.org');
    expect(json(archive).exportedAt).toBe('2026-09-18T10:00:00.000Z');
  });

  it('carries the profile picture beside the JSON, named by its own bytes', () => {
    // A real PNG header: a stored picture has no name and no type column, so
    // what the archive calls it is decided the same way serving it is (F38).
    const bytes = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(8, 0x2a),
    ]);
    const archive = participantArchive(
      record(),
      new Map([['avatars/abc', bytes]]),
      README,
      at,
    );

    expect(archive.map((one) => one.path)).toEqual([
      'README.txt',
      'export.json',
      'profile-picture.png',
    ]);
    expect(json(archive).account.profilePicture).toBe('profile-picture.png');
  });

  it('files an uploaded answer under its event and names it in the JSON', () => {
    const archive = participantArchive(
      record({
        profile: { ...record().profile, avatarPath: null },
        registrations: [
          {
            id: 'r1',
            eventTitle: 'Kickoff',
            eventSlug: 'kickoff',
            seriesTitle: 'Climate',
            seriesSlug: 'climate',
            eventStartsAt: new Date('2026-03-01T09:00:00.000Z'),
            email: 'amina@example.org',
            firstName: 'Amina',
            lastName: 'Okonkwo',
            phone: null,
            origin: null,
            customFields: {},
            status: 'confirmed',
            newsletterOptIn: false,
            contactOptOut: false,
            confirmedAt: null,
            createdAt: new Date('2026-02-01T00:00:00.000Z'),
            files: [
              {
                path: 'attachments/xyz',
                fileName: 'visa.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 4,
                fieldKey: 'visa',
              },
            ],
          },
        ],
      }),
      new Map([['attachments/xyz', Buffer.from('%PDF')]]),
      README,
      at,
    );

    expect(archive.map((one) => one.path)).toEqual([
      'README.txt',
      'export.json',
      'registrations/kickoff/visa.pdf',
    ]);
    expect(json(archive).registrations[0].files[0]).toEqual({
      fieldKey: 'visa',
      fileName: 'visa.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
      inArchive: 'registrations/kickoff/visa.pdf',
    });
  });

  it('says so in the JSON when the bytes of a file are gone', () => {
    const archive = participantArchive(
      record({
        profile: { ...record().profile, avatarPath: 'avatars/lost' },
      }),
      new Map(),
      README,
      at,
    );

    expect(archive.map((one) => one.path)).toEqual([
      'README.txt',
      'export.json',
    ]);
    expect(json(archive).account.profilePicture).toBeNull();
  });

  it('gives two files of the same name two places in the archive', () => {
    const base = record().registrations;
    void base;
    const file = (fieldKey: string) => ({
      path: `attachments/${fieldKey}`,
      fileName: 'scan.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1,
      fieldKey,
    });
    const archive = participantArchive(
      record({
        profile: { ...record().profile, avatarPath: null },
        registrations: [
          {
            id: 'r1',
            eventTitle: 'Kickoff',
            eventSlug: 'kickoff',
            seriesTitle: 'Climate',
            seriesSlug: 'climate',
            eventStartsAt: new Date('2026-03-01T09:00:00.000Z'),
            email: 'amina@example.org',
            firstName: 'Amina',
            lastName: 'Okonkwo',
            phone: null,
            origin: null,
            customFields: {},
            status: 'confirmed',
            newsletterOptIn: false,
            contactOptOut: false,
            confirmedAt: null,
            createdAt: new Date('2026-02-01T00:00:00.000Z'),
            files: [file('visa'), file('passport')],
          },
        ],
      }),
      new Map([
        ['attachments/visa', Buffer.from('a')],
        ['attachments/passport', Buffer.from('b')],
      ]),
      README,
      at,
    );

    expect(archive.map((one) => one.path)).toEqual([
      'README.txt',
      'export.json',
      'registrations/kickoff/scan.pdf',
      'registrations/kickoff/scan (2).pdf',
    ]);
  });

  it('carries both halves of a conversation and only this person’s picture', () => {
    const archive = participantArchive(
      record({
        profile: { ...record().profile, avatarPath: null },
        conversations: [
          {
            id: 'c1',
            type: 'direct',
            topic: null,
            counterparts: ['Bilal Haddad'],
            joinedAt: new Date('2026-02-01T00:00:00.000Z'),
            messages: [
              {
                id: 'm1',
                mine: true,
                body: 'Hallo',
                file: {
                  path: 'messages/mine',
                  fileName: 'karte.png',
                  mimeType: 'image/png',
                  sizeBytes: 1,
                  fieldKey: null,
                },
                sentAt: new Date('2026-02-02T00:00:00.000Z'),
              },
              {
                id: 'm2',
                mine: false,
                body: 'Hi',
                file: null,
                sentAt: new Date('2026-02-03T00:00:00.000Z'),
              },
            ],
          },
        ],
      }),
      new Map([['messages/mine', Buffer.from('x')]]),
      README,
      at,
    );

    expect(archive.map((one) => one.path)).toEqual([
      'README.txt',
      'export.json',
      'messages/c1/karte.png',
    ]);
    const conversation = json(archive).conversations[0];
    expect(
      conversation.messages.map((one: { mine: boolean }) => one.mine),
    ).toEqual([true, false]);
    expect(conversation.counterparts).toEqual(['Bilal Haddad']);
  });

  it('carries the sentences as a file of their own, and no prose in the JSON', () => {
    const archive = participantArchive(record(), new Map(), README, at);

    expect(
      archive.find((one) => one.path === 'README.txt')?.bytes.toString('utf8'),
    ).toBe(README);
    expect(
      archive.find((one) => one.path === 'export.json')?.bytes.toString('utf8'),
    ).not.toContain('Was in diesem Archiv');
  });

  it('produces entries a zip writer accepts', () => {
    expect(() =>
      zipArchive(participantArchive(record(), new Map(), README, at), at),
    ).not.toThrow();
  });
});
