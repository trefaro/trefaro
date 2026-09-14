import { EnvValidationError, loadEnv } from './env';

const productionBase = {
  NODE_ENV: 'production',
  AUTH_SECRET: 'a'.repeat(32),
  DATABASE_PASSWORD: 'secret',
};

describe('loadEnv', () => {
  it('applies development defaults when nothing is configured', () => {
    const env = loadEnv({});

    expect(env.nodeEnv).toBe('development');
    expect(env.port).toBe(3000);
    expect(env.database.host).toBe('localhost');
    expect(env.database.synchronize).toBe(false);
    expect(env.webPush).toBeNull();
  });

  it('requires secrets in production', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(
      EnvValidationError,
    );
  });

  it('reports every problem at once instead of only the first', () => {
    let problems: readonly string[] = [];
    try {
      loadEnv({ NODE_ENV: 'production', SERVER_PORT: 'not-a-number' });
    } catch (error) {
      problems = (error as EnvValidationError).problems;
    }

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('AUTH_SECRET'),
        expect.stringContaining('DATABASE_PASSWORD'),
        expect.stringContaining('SERVER_PORT'),
      ]),
    );
  });

  it('rejects a short production AUTH_SECRET', () => {
    expect(() =>
      loadEnv({ ...productionBase, AUTH_SECRET: 'too-short' }),
    ).toThrow(/AUTH_SECRET must be at least 32/);
  });

  it('refuses schema auto-sync in production', () => {
    expect(() =>
      loadEnv({ ...productionBase, DATABASE_SYNCHRONIZE: 'true' }),
    ).toThrow(/DATABASE_SYNCHRONIZE must be off in production/);
  });

  it('allows schema auto-sync in development', () => {
    expect(loadEnv({ DATABASE_SYNCHRONIZE: 'true' }).database.synchronize).toBe(
      true,
    );
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV must be/);
  });

  it('rejects a non-boolean flag', () => {
    expect(() => loadEnv({ DATABASE_SSL: 'maybe' })).toThrow(
      /DATABASE_SSL must be a boolean/,
    );
  });

  it('enables push only when both VAPID keys are present', () => {
    expect(
      loadEnv({
        VAPID_PUBLIC_KEY: 'pub',
        VAPID_PRIVATE_KEY: 'priv',
        VAPID_SUBJECT: 'mailto:ngo@example.org',
      }).webPush,
    ).toEqual({
      publicKey: 'pub',
      privateKey: 'priv',
      subject: 'mailto:ngo@example.org',
    });

    expect(() => loadEnv({ VAPID_PUBLIC_KEY: 'pub' })).toThrow(
      /must be set together/,
    );
  });

  it('leaves the bootstrap administrator unset by default', () => {
    const env = loadEnv({});

    expect(env.adminAuth.bootstrap).toBeNull();
    expect(env.adminAuth.sessionTtlHours).toBe(12);
  });

  it('reads the bootstrap administrator when both values are given', () => {
    const env = loadEnv({
      ADMIN_BOOTSTRAP_EMAIL: 'first@example.org',
      ADMIN_BOOTSTRAP_PASSWORD: 'correct horse battery',
    });

    expect(env.adminAuth.bootstrap).toEqual({
      email: 'first@example.org',
      password: 'correct horse battery',
    });
  });

  it('refuses a bootstrap administrator without a password', () => {
    expect(() =>
      loadEnv({ ADMIN_BOOTSTRAP_EMAIL: 'first@example.org' }),
    ).toThrow(/ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD/);
  });

  it('accepts a fully configured production environment', () => {
    const env = loadEnv({
      ...productionBase,
      SERVER_PORT: '8080',
      DATABASE_HOST: 'postgres',
      DATABASE_SSL: 'yes',
      SMTP_HOST: 'mail.example.org',
      SMTP_PORT: '587',
      SMTP_SECURE: 'true',
      SMTP_USER: 'trefaro',
      SMTP_PASSWORD: 'mail-secret',
      SMTP_FROM: 'Example NGO <events@example.org>',
      PUBLIC_USER_CLIENT_URL: 'https://events.example.org',
      PUBLIC_ADMIN_CLIENT_URL: 'https://events.example.org/admin',
    });

    expect(env.port).toBe(8080);
    expect(env.database).toMatchObject({ host: 'postgres', ssl: true });
    expect(env.smtp).toMatchObject({
      host: 'mail.example.org',
      port: 587,
      secure: true,
      user: 'trefaro',
    });
    expect(env.publicUserClientUrl).toBe('https://events.example.org');
  });
});

describe('loadEnv — rate limits (E60)', () => {
  it('defaults to the numbers the instance has always shipped with', () => {
    expect(loadEnv({}).rateLimits).toEqual({
      loginAttemptsPerWindow: 20,
      registrationsPerWindow: 60,
      newsletterSignupsPerWindow: 20,
      confirmationsPerWindow: 60,
      mailsPerRecipientPerWindow: 5,
      passwordResetsPerWindow: 20,
      profile: null,
    });
  });

  it('takes every limit from the environment', () => {
    expect(
      loadEnv({
        LOGIN_ATTEMPTS_PER_WINDOW: '5',
        REGISTRATIONS_PER_WINDOW: '7',
        NEWSLETTER_SIGNUPS_PER_WINDOW: '9',
        CONFIRMATIONS_PER_WINDOW: '11',
        MAILS_PER_RECIPIENT_PER_WINDOW: '13',
        PASSWORD_RESETS_PER_WINDOW: '15',
      }).rateLimits,
    ).toMatchObject({
      loginAttemptsPerWindow: 5,
      registrationsPerWindow: 7,
      newsletterSignupsPerWindow: 9,
      confirmationsPerWindow: 11,
      mailsPerRecipientPerWindow: 13,
      passwordResetsPerWindow: 15,
    });
  });

  it('refuses a limit that is not a positive integer', () => {
    expect(() => loadEnv({ REGISTRATIONS_PER_WINDOW: '0' })).toThrow(
      /REGISTRATIONS_PER_WINDOW must be a positive integer/,
    );
  });

  // E61: a test profile is never what an instance ships, so the server has to
  // be able to say which one it is running under.
  it('carries the name of the profile the values came from', () => {
    expect(loadEnv({ RATE_LIMIT_PROFILE: 'e2e' }).rateLimits.profile).toBe(
      'e2e',
    );
  });
});

describe('loadEnv — the mail server (E62)', () => {
  /** Production refuses to start without a mail server at all. */
  const withMailServer = {
    ...productionBase,
    SMTP_HOST: 'mail.example.org',
    SMTP_FROM: 'Example NGO <events@example.org>',
  };

  it('requires encryption in production and not in development', () => {
    expect(loadEnv({}).smtp.requireTls).toBe(false);
    expect(loadEnv(withMailServer).smtp.requireTls).toBe(true);
  });

  /*
   * The one way to switch it off, and the reason it is a variable at all: an
   * organization whose mail server sits on the same host and speaks no
   * STARTTLS has to be able to say so — in an `.env`, where it is visible and
   * where the startup log can complain about it (E62).
   */
  it('lets a production instance say it cannot encrypt', () => {
    expect(
      loadEnv({ ...withMailServer, SMTP_REQUIRE_TLS: 'false' }).smtp.requireTls,
    ).toBe(false);
  });

  it('defaults the pause between two mails to a second', () => {
    expect(loadEnv({}).smtp.pauseBetweenMailsMs).toBe(1000);
  });

  it('takes the pause from the environment', () => {
    expect(
      loadEnv({ SMTP_PAUSE_BETWEEN_MAILS_MS: '150' }).smtp.pauseBetweenMailsMs,
    ).toBe(150);
  });

  // Zero is not a pause, and a sender without one is the state this package
  // was written to end.
  it('refuses a pause that is not a positive integer', () => {
    expect(() => loadEnv({ SMTP_PAUSE_BETWEEN_MAILS_MS: '0' })).toThrow(
      /SMTP_PAUSE_BETWEEN_MAILS_MS must be a positive integer/,
    );
  });
});
