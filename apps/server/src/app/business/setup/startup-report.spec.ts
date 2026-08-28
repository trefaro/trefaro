import type { TrefaroEnv } from '../../core/config/env';
import { startupWarnings } from './startup-report';

/**
 * The operator's checklist (NFR 15).
 *
 * What is asserted here is the class of problem this list exists for: a value
 * that is present, passes validation, starts the instance — and makes something
 * fail days later, in a place that does not name it. The TLS case is the one
 * worth the file on its own: with `Secure` on the session cookie (E2) a
 * production instance behind plain HTTP accepts the password and then simply
 * does not stay logged in.
 */
function envWith(overrides: Partial<TrefaroEnv> = {}): TrefaroEnv {
  return {
    nodeEnv: 'production',
    port: 3000,
    uploadDir: '/app/uploads',
    pluginBundleDir: '/app/plugins',
    publicUserClientUrl: 'https://events.example.org',
    publicAdminClientUrl: 'https://events.example.org/admin',
    authSecret: 'x'.repeat(48),
    adminAuth: { sessionTtlHours: 12, bootstrap: null },
    database: {
      host: 'postgres',
      port: 5432,
      user: 'trefaro',
      password: 'secret',
      name: 'trefaro',
      ssl: false,
      synchronize: false,
    },
    smtp: {
      host: 'mail.example.org',
      port: 587,
      secure: true,
      user: 'trefaro',
      password: 'secret',
      from: 'Events <no-reply@example.org>',
    },
    webPush: {
      publicKey: 'public',
      privateKey: 'private',
      subject: 'mailto:admin@example.org',
    },
    ...overrides,
  } as TrefaroEnv;
}

describe('startupWarnings', () => {
  it('says nothing about a deployment that is actually configured', () => {
    expect(startupWarnings(envWith())).toEqual([]);
  });

  it('warns that nobody can sign in over plain HTTP, per public URL', () => {
    const warnings = startupWarnings(
      envWith({
        publicUserClientUrl: 'http://events.example.org',
        publicAdminClientUrl: 'http://events.example.org/admin',
      }),
    );

    expect(warnings).toHaveLength(2);
    // The consequence, not the rule: "set TLS up" is advice, "administrators
    // cannot sign in" is what the operator is about to experience.
    expect(warnings[0]).toContain('PUBLIC_USER_CLIENT_URL');
    expect(warnings[0]).toContain('cannot sign in');
    expect(warnings[1]).toContain('PUBLIC_ADMIN_CLIENT_URL');
  });

  it('accepts a localhost origin without TLS, because browsers do', () => {
    // A stack tried out on the operator's own machine is the normal first step
    // of the installation, and it works: `Secure` cookies are stored over
    // http://localhost. Warning there would train the operator to ignore the
    // list before they reach the deployment where it matters.
    expect(
      startupWarnings(
        envWith({
          publicUserClientUrl: 'http://localhost:8080',
          publicAdminClientUrl: 'http://127.0.0.1:8080/admin',
        }),
      ),
    ).toEqual([]);
  });

  it('warns when the mail server is the development one', () => {
    const warnings = startupWarnings(
      envWith({
        smtp: { ...envWith().smtp, host: 'localhost' },
      }),
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('SMTP_HOST');
    // Double opt-in is the only way to become a participant, so this is not a
    // missing convenience.
    expect(warnings[0]).toContain('double opt-in');
  });

  it('warns about a sender address no mail server will accept', () => {
    // The development default from `.env.example`: it works against Mailpit and
    // fails silently against a relay.
    for (const from of ['Trefaro <no-reply@localhost>', 'no-reply@trefaro']) {
      const warnings = startupWarnings(
        envWith({ smtp: { ...envWith().smtp, from } }),
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('SMTP_FROM');
    }
  });

  it('says nothing about a sender at a real domain, in either notation', () => {
    // Whether it is *the organization's* domain depends on SPF and DKIM records
    // this application cannot see, so only the shape is judged.
    for (const from of [
      'Events <no-reply@example.org>',
      'no-reply@example.org',
    ]) {
      expect(
        startupWarnings(envWith({ smtp: { ...envWith().smtp, from } })),
      ).toEqual([]);
    }
  });

  it('says push is unconfigured in every environment, because the switch exists anyway', () => {
    // The module can be switched on without a key pair (E21 keeps those two
    // conditions apart), and then the clients never offer a subscription. That
    // is worth one line in development too.
    for (const nodeEnv of ['development', 'production'] as const) {
      const warnings = startupWarnings(envWith({ nodeEnv, webPush: null }));
      expect(warnings.some((line) => line.includes('VAPID_PUBLIC_KEY'))).toBe(
        true,
      );
    }
  });

  it('keeps the production-only findings out of a development log', () => {
    const warnings = startupWarnings(
      envWith({
        nodeEnv: 'development',
        publicUserClientUrl: 'http://localhost:4200',
        publicAdminClientUrl: 'http://localhost:4300',
        smtp: { ...envWith().smtp, host: 'localhost', from: 'T <t@localhost>' },
      }),
    );

    // Mailpit and two plain-HTTP dev servers are the intended development setup.
    expect(warnings).toEqual([]);
  });

  it('warns about an unencrypted connection to a database somewhere else', () => {
    const warnings = startupWarnings(
      envWith({
        database: { ...envWith().database, host: 'db.example.org', ssl: false },
      }),
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('DATABASE_SSL');
  });

  it('says nothing about the database inside the container stack', () => {
    // `postgres` is the compose service name and is not on any network the
    // outside world can reach, so TLS between the two containers buys nothing.
    expect(startupWarnings(envWith())).toEqual([]);
  });
});
