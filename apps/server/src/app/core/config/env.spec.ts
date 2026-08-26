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
      loadEnv({ NODE_ENV: 'production', PORT: 'not-a-number' });
    } catch (error) {
      problems = (error as EnvValidationError).problems;
    }

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('AUTH_SECRET'),
        expect.stringContaining('DATABASE_PASSWORD'),
        expect.stringContaining('PORT'),
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

  it('accepts a fully configured production environment', () => {
    const env = loadEnv({
      ...productionBase,
      PORT: '8080',
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
