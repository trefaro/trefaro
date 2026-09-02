import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { FileArea, FileStore } from '../attachments';
import { ImageFileService } from '../common/image-file.service';
import type { PasswordHasher } from '../common/password-hasher.service';
import type { ConfigurationService } from '../config';
import { MailDeliveryError, type MailService, type PublicLinks } from '../mail';
import type { TokenSigner } from '../security';
import type {
  NewProfileField,
  ProfileFieldChanges,
  ProfileFieldRecord,
  ProfileFieldRepository,
} from './ports/profile-field.repository';
import type { AuthenticatedParticipant } from './ports/user-session.repository';
import type {
  NewUserProfile,
  UserProfileChanges,
  UserProfileRecord,
  UserProfileRepository,
} from './ports/user-profile.repository';
import { ProfileFieldsService } from './profile-fields.service';
import { ProfilesService } from './profiles.service';
import type { UserSessionService } from './user-session.service';

const PASSWORD = 'a-long-enough-passphrase';

/** In-memory stand-in for the port; the address is the identity (E31). */
class FakeProfileRepository implements UserProfileRepository {
  readonly rows: UserProfileRecord[] = [];
  private next = 1;

  async findById(id: string): Promise<UserProfileRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<UserProfileRecord | null> {
    const wanted = email.toLowerCase();
    return this.rows.find((row) => row.email.toLowerCase() === wanted) ?? null;
  }

  async create(profile: NewUserProfile): Promise<UserProfileRecord> {
    const row: UserProfileRecord = {
      id: `profile-${this.next++}`,
      ...profile,
      avatarPath: null,
      activityAreas: null,
      customFields: {},
      searchable: false,
      confirmedAt: null,
      createdAt: new Date('2026-09-02T09:00:00Z'),
      updatedAt: new Date('2026-09-02T09:00:00Z'),
    };
    this.rows.push(row);
    return row;
  }

  async update(
    id: string,
    changes: UserProfileChanges,
  ): Promise<UserProfileRecord | null> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    const updated = { ...this.rows[index], ...changes };
    this.rows[index] = updated;
    return updated;
  }

  /**
   * Its own method for the same reason the port declares one (F116): the path
   * column is not something a form can write, so the fake cannot let it be
   * either. It moves `updatedAt`, because the real one does — that timestamp is
   * the picture's `?v=`.
   */
  async setAvatarPath(
    id: string,
    storedPath: string | null,
  ): Promise<UserProfileRecord | null> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    const updated = {
      ...this.rows[index],
      avatarPath: storedPath,
      updatedAt: new Date('2026-09-02T11:00:00Z'),
    };
    this.rows[index] = updated;
    return updated;
  }
}

/** The profile questions this instance asks, in memory (E35). */
class FakeProfileFieldRepository implements ProfileFieldRepository {
  rows: ProfileFieldRecord[] = [];

  async findAll(): Promise<readonly ProfileFieldRecord[]> {
    return [...this.rows].sort((a, b) => a.sort - b.sort);
  }

  async findById(id: string): Promise<ProfileFieldRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async create(field: NewProfileField): Promise<ProfileFieldRecord> {
    const row = { id: `field-${this.rows.length + 1}`, ...field };
    this.rows.push(row);
    return row;
  }

  async update(
    id: string,
    changes: ProfileFieldChanges,
  ): Promise<ProfileFieldRecord | null> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    this.rows[index] = { ...this.rows[index], ...changes };
    return this.rows[index];
  }

  async delete(id: string): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => row.id !== id);
    return this.rows.length < before;
  }

  async reorder(
    orderedIds: readonly string[],
  ): Promise<readonly ProfileFieldRecord[]> {
    this.rows = this.rows.map((row) => ({
      ...row,
      sort: orderedIds.indexOf(row.id),
    }));
    return this.findAll();
  }
}

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

const zip = (): Buffer =>
  Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(16)]);

describe('ProfilesService', () => {
  let profiles: FakeProfileRepository;
  let fields: FakeProfileFieldRepository;
  let files: FakeFileStore;
  let revokedOthers: { userId: string; keepSessionId: string }[];
  let service: ProfilesService;
  let sent: { kind: string; to: string; context: unknown }[];
  let failMail: boolean;
  let signed: { purpose: string; subject: string }[];

  /**
   * A hasher that really is one-way, as far as this suite can tell: it hands
   * out an opaque handle and keeps the mapping to itself. A fake that returned
   * `hashed:${password}` would make the assertion "the password appears nowhere
   * in the row" pass for the wrong reason — and fail for the right one.
   */
  const secrets = new Map<string, string>();
  const hasher = {
    hash: (password: string) => {
      const handle = `argon2id$${secrets.size + 1}`;
      secrets.set(handle, password);
      return Promise.resolve(handle);
    },
    verify: (hash: string, password: string) =>
      Promise.resolve(secrets.get(hash) === password),
    equalizeTiming: () => Promise.resolve(),
  } as unknown as PasswordHasher;

  const registration = {
    email: 'Amina@Example.org',
    password: PASSWORD,
    firstName: ' Amina ',
    lastName: 'Okonkwo',
    preferredLocale: 'DE',
  };

  beforeEach(() => {
    profiles = new FakeProfileRepository();
    fields = new FakeProfileFieldRepository();
    files = new FakeFileStore();
    revokedOthers = [];
    secrets.clear();
    sent = [];
    failMail = false;
    signed = [];

    const mail = {
      sendProfileConfirmation: (to: string, context: unknown) => {
        if (failMail) return Promise.reject(new MailDeliveryError('smtp down'));
        sent.push({ kind: 'confirmation', to, context });
        return Promise.resolve();
      },
      sendProfileExists: (to: string, context: unknown) => {
        if (failMail) return Promise.reject(new MailDeliveryError('smtp down'));
        sent.push({ kind: 'exists', to, context });
        return Promise.resolve();
      },
    } as unknown as MailService;

    const tokens = {
      sign: (purpose: string, subject: string) => {
        signed.push({ purpose, subject });
        return `token-for-${subject}`;
      },
      verify: (purpose: string, token: string) =>
        purpose === 'profile-confirmation' && token.startsWith('token-for-')
          ? token.slice('token-for-'.length)
          : null,
    } as unknown as TokenSigner;

    const links = {
      url: (path: string) => `https://events.example.org${path}`,
      token: (path: string, token: string) =>
        `https://events.example.org${path}?token=${token}`,
    } as unknown as PublicLinks;

    const configuration = {
      getLocaleSettings: () =>
        Promise.resolve({ defaultLocale: 'en', activeLocales: ['en', 'de'] }),
    } as unknown as ConfigurationService;

    const sessions = {
      revokeOthers: (userId: string, keepSessionId: string) => {
        revokedOthers.push({ userId, keepSessionId });
        return Promise.resolve();
      },
    } as unknown as UserSessionService;

    service = new ProfilesService(
      profiles,
      hasher,
      mail,
      tokens,
      links,
      configuration,
      // The real field service on a fake repository, and the real image service
      // on a fake volume: both of them are the rule under test here, and a stub
      // would only assert that a method was called.
      new ProfileFieldsService(fields),
      new ImageFileService(files),
      sessions,
    );
  });

  describe('register', () => {
    it('creates an unconfirmed account and mails a confirmation link', async () => {
      const acknowledgement = await service.register(registration);

      expect(acknowledgement).toEqual({ email: 'amina@example.org' });
      expect(profiles.rows).toHaveLength(1);
      // The address is stored in one form, the name trimmed, the tag lowercased.
      expect(profiles.rows[0]).toMatchObject({
        email: 'amina@example.org',
        firstName: 'Amina',
        preferredLocale: 'de',
        confirmedAt: null,
      });
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({
        kind: 'confirmation',
        to: 'amina@example.org',
      });
      expect(signed).toEqual([
        { purpose: 'profile-confirmation', subject: 'profile-1' },
      ]);
    });

    it('never stores the password itself', async () => {
      await service.register(registration);

      expect(profiles.rows[0].passwordHash).not.toBe(PASSWORD);
      expect(JSON.stringify(profiles.rows)).not.toContain(PASSWORD);
    });

    it('falls back to the instance language when the form sends none', async () => {
      await service.register({ ...registration, preferredLocale: undefined });

      expect(profiles.rows[0].preferredLocale).toBe('en');
    });

    it('refuses a password the policy rejects, before writing or sending anything', async () => {
      await expect(
        service.register({ ...registration, password: 'short' }),
      ).rejects.toThrow(BadRequestException);

      expect(profiles.rows).toHaveLength(0);
      expect(sent).toHaveLength(0);
    });

    it('answers a second attempt on an unconfirmed address exactly like the first (E32)', async () => {
      const first = await service.register(registration);
      const second = await service.register({
        ...registration,
        firstName: 'Aminata',
      });

      expect(second).toEqual(first);
      // One row, not two — and still being written, so the corrected name lands.
      expect(profiles.rows).toHaveLength(1);
      expect(profiles.rows[0].firstName).toBe('Aminata');
      expect(sent.map((mail) => mail.kind)).toEqual([
        'confirmation',
        'confirmation',
      ]);
    });

    it('answers a confirmed address the same way, and changes nothing about it', async () => {
      await service.register(registration);
      await service.confirm('token-for-profile-1');
      const before = { ...profiles.rows[0] };

      const answer = await service.register({
        ...registration,
        firstName: 'Somebody',
        password: 'a-completely-different-passphrase',
      });

      expect(answer).toEqual({ email: 'amina@example.org' });
      // Not a word of it was applied: this endpoint is unauthenticated, and
      // anyone who knows an address could otherwise take over its account.
      expect(profiles.rows).toEqual([before]);
      // The difference is in the mail, which only its recipient reads.
      expect(sent.at(-1)).toMatchObject({
        kind: 'exists',
        to: 'amina@example.org',
        context: {
          firstName: 'Amina',
          loginUrl: 'https://events.example.org/profile/login',
        },
      });
    });

    it('mints no token for an address that already has an account', async () => {
      await service.register(registration);
      await service.confirm('token-for-profile-1');
      signed = [];

      await service.register(registration);

      expect(signed).toEqual([]);
    });

    it('answers a mail failure identically for a known and an unknown address (E32)', async () => {
      failMail = true;

      const unknown = await service
        .register({ ...registration, email: 'nobody@example.org' })
        .catch((error: unknown) => error);

      failMail = false;
      await service.register(registration);
      await service.confirm('token-for-profile-1');
      failMail = true;

      const known = await service
        .register(registration)
        .catch((error: unknown) => error);

      expect(unknown).toBeInstanceOf(ServiceUnavailableException);
      expect(known).toBeInstanceOf(ServiceUnavailableException);
      expect((known as Error).message).toBe((unknown as Error).message);
    });
  });

  describe('confirm', () => {
    it('confirms once and reports the state on a second click (E5b)', async () => {
      await service.register(registration);

      await expect(service.confirm('token-for-profile-1')).resolves.toEqual({
        state: 'confirmed',
        firstName: 'Amina',
      });
      await expect(service.confirm('token-for-profile-1')).resolves.toEqual({
        state: 'already-confirmed',
        firstName: 'Amina',
      });
      expect(profiles.rows[0].confirmedAt).toBeInstanceOf(Date);
    });

    it('refuses a forged or expired token', async () => {
      await expect(service.confirm('not-a-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses a token for an account that is gone', async () => {
      await expect(service.confirm('token-for-profile-9')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('checkCredentials', () => {
    it('rejects an unknown address', async () => {
      await expect(
        service.checkCredentials('nobody@example.org', PASSWORD),
      ).resolves.toEqual({ outcome: 'rejected' });
    });

    it('rejects a wrong password', async () => {
      await service.register(registration);
      await service.confirm('token-for-profile-1');

      await expect(
        service.checkCredentials(registration.email, 'wrong-passphrase'),
      ).resolves.toEqual({ outcome: 'rejected' });
    });

    it('refuses to let an unconfirmed account in, but says so (E32)', async () => {
      await service.register(registration);

      await expect(
        service.checkCredentials(registration.email, PASSWORD),
      ).resolves.toEqual({ outcome: 'unconfirmed' });
    });

    it('authenticates a confirmed account, whatever case the address was typed in', async () => {
      await service.register(registration);
      await service.confirm('token-for-profile-1');

      const check = await service.checkCredentials(
        ' AMINA@example.ORG ',
        PASSWORD,
      );

      expect(check).toMatchObject({ outcome: 'authenticated' });
    });
  });

  describe('updateProfile', () => {
    /** A confirmed account to edit, which is the only state that can be. */
    const signedUp = async (): Promise<string> => {
      await service.register(registration);
      await service.confirm('token-for-profile-1');
      return 'profile-1';
    };

    it('changes only what the form sent', async () => {
      const id = await signedUp();

      const updated = await service.updateProfile(id, { lastName: 'Okoro' });

      expect(updated).toMatchObject({
        firstName: 'Amina',
        lastName: 'Okoro',
        preferredLocale: 'de',
      });
    });

    it('trims a name and refuses an emptied one', async () => {
      const id = await signedUp();

      await expect(
        service.updateProfile(id, { firstName: '  Amina  ' }),
      ).resolves.toMatchObject({ firstName: 'Amina' });

      await expect(
        service.updateProfile(id, { firstName: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('stores an emptied field of activity as nothing at all (E36)', async () => {
      const id = await signedUp();

      await expect(
        service.updateProfile(id, { activityAreas: '  Election observation ' }),
      ).resolves.toMatchObject({ activityAreas: 'Election observation' });

      // Not the empty string: the search has one thing to test rather than two,
      // and nobody's profile says they work on nothing.
      await expect(
        service.updateProfile(id, { activityAreas: '' }),
      ).resolves.toMatchObject({ activityAreas: null });
    });

    it('writes `searchable`, which nothing reads yet (E37)', async () => {
      const id = await signedUp();

      await expect(
        service.updateProfile(id, { searchable: true }),
      ).resolves.toMatchObject({ searchable: true });
    });

    it('checks the answers against the definitions, not against a DTO (E35)', async () => {
      const id = await signedUp();
      await fields.create({
        key: 'local-group',
        label: 'Local group',
        type: 'select',
        helpText: null,
        options: ['Cologne', 'Nairobi'],
        required: true,
        sort: 0,
      });

      await expect(
        service.updateProfile(id, {
          customFields: { 'local-group': 'Cologne' },
        }),
      ).resolves.toMatchObject({ customFields: { 'local-group': 'Cologne' } });

      // A value the definition does not offer, a key nothing asked for, and a
      // required question left blank — three different mistakes, all 400.
      await expect(
        service.updateProfile(id, { customFields: { 'local-group': 'Bonn' } }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateProfile(id, {
          customFields: { 'favourite-colour': 'red' },
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateProfile(id, { customFields: {} }),
      ).rejects.toThrow(BadRequestException);
    });

    it('leaves the answers alone when the form did not send them', async () => {
      const id = await signedUp();
      await fields.create({
        key: 'local-group',
        label: 'Local group',
        type: 'text',
        helpText: null,
        options: [],
        required: true,
        sort: 0,
      });
      await service.updateProfile(id, {
        customFields: { 'local-group': 'Cologne' },
      });

      // The required question is not re-checked, and that is the point: a name
      // correction must not fail because a question was answered last month.
      const updated = await service.updateProfile(id, { lastName: 'Okoro' });

      expect(updated.customFields).toEqual({ 'local-group': 'Cologne' });
    });

    it('keeps the answers of a question that was removed (F34)', async () => {
      const id = await signedUp();
      const field = await fields.create({
        key: 'local-group',
        label: 'Local group',
        type: 'text',
        helpText: null,
        options: [],
        required: false,
        sort: 0,
      });
      await service.updateProfile(id, {
        customFields: { 'local-group': 'Cologne' },
      });

      await fields.delete(field.id);

      // What somebody wrote about themselves is theirs; the definition was
      // only the question. Nothing renders it any more.
      expect(profiles.rows[0].customFields).toEqual({
        'local-group': 'Cologne',
      });
    });
  });

  describe('changePassword', () => {
    const current = async (): Promise<AuthenticatedParticipant> => {
      await service.register(registration);
      await service.confirm('token-for-profile-1');
      return {
        sessionId: 'session-1',
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
        profile: profiles.rows[0],
      };
    };

    it('refuses a wrong current password, and changes nothing', async () => {
      const session = await current();
      const before = profiles.rows[0].passwordHash;

      await expect(
        service.changePassword(session, {
          currentPassword: 'not-the-passphrase',
          newPassword: 'another-long-passphrase',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(profiles.rows[0].passwordHash).toBe(before);
      expect(revokedOthers).toEqual([]);
    });

    it('refuses a new password the policy rejects', async () => {
      const session = await current();

      await expect(
        service.changePassword(session, {
          currentPassword: PASSWORD,
          newPassword: 'short',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('changes it, and ends every other session of the account', async () => {
      const session = await current();

      await service.changePassword(session, {
        currentPassword: PASSWORD,
        newPassword: 'another-long-passphrase',
      });

      const check = await service.checkCredentials(
        registration.email,
        'another-long-passphrase',
      );
      expect(check).toMatchObject({ outcome: 'authenticated' });
      // The session doing the changing survives: the screen in front of the
      // person must not log itself out.
      expect(revokedOthers).toEqual([
        { userId: 'profile-1', keepSessionId: 'session-1' },
      ]);
    });
  });

  describe('the profile picture', () => {
    const signedUp = async (): Promise<string> => {
      await service.register(registration);
      await service.confirm('token-for-profile-1');
      return 'profile-1';
    };

    it('writes into the avatar area and answers a path-free URL (F124)', async () => {
      const id = await signedUp();

      const url = await service.setAvatar(id, {
        mimeType: 'image/png',
        bytes: png(),
      });

      expect(files.areas).toEqual(['avatars']);
      expect(profiles.rows[0].avatarPath).toMatch(/^avatars\//);
      // The URL names the account and carries the row's timestamp, never the
      // stored path — the neighbours of a stored path are attachments (E9).
      expect(url).toBe(
        `/api/media/profiles/${id}/avatar?v=${profiles.rows[0].updatedAt.getTime()}`,
      );
      expect(url).not.toContain(profiles.rows[0].avatarPath);
    });

    it('refuses bytes that disagree with the declared type, and writes nothing (F38)', async () => {
      const id = await signedUp();

      await expect(
        service.setAvatar(id, { mimeType: 'image/png', bytes: zip() }),
      ).rejects.toThrow(BadRequestException);

      expect(files.files.size).toBe(0);
      expect(profiles.rows[0].avatarPath).toBeNull();
    });

    it('unlinks the previous picture once nothing names it', async () => {
      const id = await signedUp();
      await service.setAvatar(id, { mimeType: 'image/png', bytes: png() });
      const first = profiles.rows[0].avatarPath;

      await service.setAvatar(id, { mimeType: 'image/png', bytes: png(32) });

      expect(files.removed).toEqual([first]);
      expect(profiles.rows[0].avatarPath).not.toBe(first);
    });

    it('removes the picture, column first and file second', async () => {
      const id = await signedUp();
      await service.setAvatar(id, { mimeType: 'image/png', bytes: png() });
      const stored = profiles.rows[0].avatarPath;

      await expect(service.removeAvatar(id)).resolves.toBeNull();

      expect(profiles.rows[0].avatarPath).toBeNull();
      expect(files.removed).toEqual([stored]);
    });

    it('answers the type the bytes say, and nothing for a profile without one', async () => {
      const id = await signedUp();

      expect(await service.readAvatar(id)).toBeNull();

      await service.setAvatar(id, { mimeType: 'image/png', bytes: png() });

      expect(await service.readAvatar(id)).toMatchObject({
        mimeType: 'image/png',
      });
    });

    it('answers nothing for an account that does not exist', async () => {
      // The same answer as "no picture", deliberately: from outside, the two
      // must look the same (F115 applied to a person).
      expect(await service.readAvatar('profile-404')).toBeNull();
    });
  });
});
