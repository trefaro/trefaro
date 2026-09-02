import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PasswordHasher } from '../common/password-hasher.service';
import type { ConfigurationService } from '../config';
import { MailDeliveryError, type MailService, type PublicLinks } from '../mail';
import type { TokenSigner } from '../security';
import type {
  NewUserProfile,
  UserProfileChanges,
  UserProfileRecord,
  UserProfileRepository,
} from './ports/user-profile.repository';
import { ProfilesService } from './profiles.service';

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
}

describe('ProfilesService', () => {
  let profiles: FakeProfileRepository;
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

    service = new ProfilesService(
      profiles,
      hasher,
      mail,
      tokens,
      links,
      configuration,
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
});
