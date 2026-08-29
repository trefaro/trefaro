import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import type { AppConfig, AppConfigChange } from '@trefaro/shared-models';
import type { TrefaroEnv } from '../../core/config/env';
import type { ConfigurationService } from '../config';
import type { AdminSummary, AdminUserService } from '../login';
import type { MailCatalogue } from '../mail';
import { SetupTokenService } from './setup-token.service';
import { SetupService } from './setup.service';

/**
 * First-run setup (FR 1.1, E28).
 *
 * This is where the happy path of the wizard is proven, and it has to be: on any
 * instance that has an administrator the endpoints do not exist, so no
 * end-to-end suite can walk them — every suite in this repository runs against
 * an instance created with `ADMIN_BOOTSTRAP_*`, and the last administrator
 * cannot be deleted (by design). What the live checks assert is the other half:
 * that the route is closed. `tools/spike-verification/verify-setup.mjs` walks it
 * against a genuinely fresh stack.
 */
class FakeAdmins {
  count = 0;
  readonly created: { email: string; name: string; password: string }[] = [];
  failCreateWith: unknown = null;

  async hasAny(): Promise<boolean> {
    return this.count > 0;
  }

  async create(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<AdminSummary> {
    if (this.failCreateWith) throw this.failCreateWith;
    this.created.push(input);
    this.count += 1;
    return {
      id: 'admin-1',
      email: input.email,
      name: input.name,
      createdAt: new Date('2026-08-28T09:00:00.000Z'),
      lastLoginAt: null,
    };
  }
}

class FakeConfiguration {
  organizationName = 'Trefaro';
  primaryColor = '#1f6f5c';
  accentColor = '#e8a33d';
  defaultLocale = 'en';
  readonly writes: AppConfigChange[] = [];
  readonly locales: string[] = [];
  failUpdateWith: unknown = null;

  async getAppConfig(): Promise<AppConfig> {
    return {
      organizationName: this.organizationName,
      theme: {
        primaryColor: this.primaryColor,
        accentColor: this.accentColor,
        logoUrl: null,
        fontFamily: 'system-ui, sans-serif',
      },
      defaultLocale: this.defaultLocale,
      availableLocales: ['en'],
      enabledModules: [],
      plugins: [],
      webPushPublicKey: null,
      publicUserClientUrl: 'http://localhost:4200',
      appIconUrl: null,
    };
  }

  async updateSettings(change: AppConfigChange) {
    if (this.failUpdateWith) throw this.failUpdateWith;
    this.writes.push(change);
    this.organizationName = change.organizationName ?? this.organizationName;
    this.primaryColor = change.primaryColor ?? this.primaryColor;
    this.accentColor = change.accentColor ?? this.accentColor;
    return {
      organizationName: this.organizationName,
      primaryColor: this.primaryColor,
      accentColor: this.accentColor,
      fontFamily: 'system-ui',
    };
  }

  async setDefaultLocale(locale: string): Promise<void> {
    this.locales.push(locale);
    this.defaultLocale = locale;
  }
}

const SUBMISSION = {
  admin: {
    email: 'organizer@example.org',
    name: 'Alex Weber',
    password: 'a-long-enough-passphrase',
  },
  organizationName: 'Democracy International e.V.',
  defaultLocale: 'de',
  primaryColor: '#1f6f5c',
  accentColor: '#e8a33d',
} as const;

/**
 * The languages the wizard may offer, asked rather than compiled in (AP 10).
 *
 * Since the mail text is catalogue data, "can this instance write German mail"
 * is a question about its rows and its image — so the wizard asks the mail
 * module, and this fake is where a test decides what the answer is.
 */
class FakeMailCatalogue {
  forMail: string[] = ['en', 'de'];

  async localesForMail(): Promise<readonly string[]> {
    return this.forMail;
  }
}

describe('SetupService', () => {
  let admins: FakeAdmins;
  let configuration: FakeConfiguration;
  let mail: FakeMailCatalogue;
  let tokens: SetupTokenService;
  let service: SetupService;
  let warnings: string[];

  function build(env: Partial<TrefaroEnv> = {}): SetupService {
    return new SetupService(
      admins as unknown as AdminUserService,
      configuration as unknown as ConfigurationService,
      tokens,
      mail as unknown as MailCatalogue,
      {
        nodeEnv: 'development',
        publicUserClientUrl: 'http://localhost:4200',
        publicAdminClientUrl: 'http://localhost:4300',
        database: { host: 'localhost', ssl: false },
        smtp: { host: 'localhost', from: 'Trefaro <no-reply@localhost>' },
        webPush: { publicKey: 'p', privateKey: 's', subject: 'mailto:a@b' },
        ...env,
      } as TrefaroEnv,
    );
  }

  beforeEach(() => {
    admins = new FakeAdmins();
    configuration = new FakeConfiguration();
    mail = new FakeMailCatalogue();
    tokens = new SetupTokenService();
    warnings = [];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message) => {
      warnings.push(String(message));
    });
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    service = build();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('on startup', () => {
    it('issues a token and puts it in the log while nobody can log in', async () => {
      await service.onApplicationBootstrap();

      expect(tokens.isIssued()).toBe(true);
      const line = warnings.find((entry) => entry.includes('no administrator'));
      expect(line).toBeDefined();
      // The operator has the log because the operator started the container;
      // the token is on its own line so it can be copied without a full stop.
      expect(line).toContain(`\n\n    ${tokens.issue()}\n\n`);
    });

    it('issues no token for an instance that already has an administrator', async () => {
      admins.count = 1;

      await service.onApplicationBootstrap();

      // Covers the ADMIN_BOOTSTRAP_* case (E3): the login module's own bootstrap
      // hook has created the account before this module is initialised, because
      // this module imports it.
      expect(tokens.isIssued()).toBe(false);
      expect(warnings.some((entry) => entry.includes('no administrator'))).toBe(
        false,
      );
    });

    it('logs the deployment findings whether or not a setup is pending', async () => {
      admins.count = 1;
      service = build({
        nodeEnv: 'production',
        publicUserClientUrl: 'http://events.example.org',
        publicAdminClientUrl: 'http://events.example.org/admin',
      });

      await service.onApplicationBootstrap();

      expect(
        warnings.filter((entry) => entry.includes('cannot sign in')),
      ).toHaveLength(2);
    });
  });

  describe('isPending', () => {
    it('is the question "can anybody log in", asked every time', async () => {
      expect(await service.isPending()).toBe(true);

      admins.count = 1;

      // No caching: the answer changes exactly once, and a remembered "no" would
      // leave the route open after the first account was created.
      expect(await service.isPending()).toBe(false);
    });
  });

  describe('state', () => {
    it('offers the stored values so an operator can change only the name', async () => {
      const state = await service.state();

      expect(state).toMatchObject({
        organizationName: 'Trefaro',
        primaryColor: '#1f6f5c',
        accentColor: '#e8a33d',
        defaultLocale: 'en',
      });
    });

    it('offers only the languages this image can send mail in', async () => {
      // Not every BCP 47 tag: a locale without mail templates would send English
      // confirmations while the form claimed otherwise. The set opens up in AP 7.
      expect(await service.state()).toHaveProperty('locales', ['en', 'de']);
    });

    it('carries the same findings the log does', async () => {
      service = build({
        nodeEnv: 'production',
        publicUserClientUrl: 'https://events.example.org',
        publicAdminClientUrl: 'https://events.example.org/admin',
        smtp: { host: 'localhost', from: 'Events <no-reply@example.org>' },
      } as Partial<TrefaroEnv>);

      const state = await service.state();

      expect(state.warnings).toHaveLength(1);
      expect(state.warnings[0]).toContain('SMTP_HOST');
    });
  });

  describe('complete', () => {
    it('writes the identity, the language and the first account', async () => {
      const result = await service.complete(SUBMISSION);

      expect(configuration.writes).toEqual([
        {
          organizationName: 'Democracy International e.V.',
          primaryColor: '#1f6f5c',
          accentColor: '#e8a33d',
        },
      ]);
      expect(configuration.locales).toEqual(['de']);
      expect(admins.created).toEqual([SUBMISSION.admin]);
      expect(result).toEqual({
        adminEmail: 'organizer@example.org',
        organizationName: 'Democracy International e.V.',
      });
    });

    it('discards the token, which the new account has already made useless', async () => {
      const token = tokens.issue();

      await service.complete(SUBMISSION);

      expect(tokens.matches(token)).toBe(false);
    });

    it('answers 404 for a second submission', async () => {
      await service.complete(SUBMISSION);

      // The guard would already refuse this; the check is repeated in the service
      // so two submissions arriving together cannot both find an empty table.
      await expect(service.complete(SUBMISSION)).rejects.toThrow(
        NotFoundException,
      );
      expect(admins.created).toHaveLength(1);
    });

    it('refuses a language this instance cannot send mail in, before writing anything', async () => {
      await expect(
        service.complete({ ...SUBMISSION, defaultLocale: 'fr' }),
      ).rejects.toThrow(BadRequestException);

      expect(configuration.writes).toEqual([]);
      expect(admins.created).toEqual([]);
    });

    it('leaves the setup open when a value is refused', async () => {
      configuration.failUpdateWith = new BadRequestException('bad colour');

      await expect(service.complete(SUBMISSION)).rejects.toThrow(
        BadRequestException,
      );

      // The account is what closes these endpoints, so it is written last: an
      // operator whose colour was refused gets the form back, not a locked
      // instance with no way in.
      expect(admins.created).toEqual([]);
      expect(await service.isPending()).toBe(true);
    });
  });
});
