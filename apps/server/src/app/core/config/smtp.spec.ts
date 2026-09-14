import { SMTP_DEFAULTS, smtpWarnings, type SmtpEnv } from './smtp';

const smtp: SmtpEnv = {
  host: 'mail.example.org',
  port: 587,
  secure: false,
  requireTls: true,
  user: 'trefaro',
  password: 'mail-secret',
  from: 'Example NGO <events@example.org>',
  pauseBetweenMailsMs: SMTP_DEFAULTS.pauseBetweenMailsMs,
};

const inProduction = { production: true, certificateChecksDisabled: false };
const inDevelopment = { production: false, certificateChecksDisabled: false };

describe('smtpWarnings', () => {
  it('says nothing about an instance that encrypts and runs the defaults', () => {
    expect(smtpWarnings(smtp, inProduction)).toEqual([]);
  });

  it('says nothing about the development stack, which has no certificate', () => {
    expect(
      smtpWarnings(
        { ...smtp, requireTls: false, user: null, password: null },
        inDevelopment,
      ),
    ).toEqual([]);
  });

  // The line E62 forbids, in the one place it can still come from: not code,
  // but the process environment.
  it('names a disabled certificate check first, whatever else is set', () => {
    const [first] = smtpWarnings(smtp, {
      ...inProduction,
      certificateChecksDisabled: true,
    });

    expect(first).toContain('NODE_TLS_REJECT_UNAUTHORIZED');
    expect(first).toContain('NODE_EXTRA_CA_CERTS');
  });

  it('warns that a password travels in the clear, in any environment', () => {
    const [warning, ...rest] = smtpWarnings(
      { ...smtp, requireTls: false },
      inDevelopment,
    );

    expect(warning).toContain('SMTP_USER');
    expect(warning).toContain('mail.example.org:587');
    expect(rest).toEqual([]);
  });

  it('warns that a production instance hands its mail over unencrypted', () => {
    const [warning, ...rest] = smtpWarnings(
      { ...smtp, requireTls: false, user: null, password: null },
      inProduction,
    );

    expect(warning).toContain('SMTP_REQUIRE_TLS');
    expect(rest).toEqual([]);
  });

  it('does not say the same thing twice when there are credentials as well', () => {
    expect(
      smtpWarnings({ ...smtp, requireTls: false }, inProduction),
    ).toHaveLength(1);
  });

  // The other direction from a raised rate limit, and the same idea: what is
  // announced is the value that was made less careful than the shipped one.
  it('warns about a pause shorter than the default', () => {
    const [warning] = smtpWarnings(
      { ...smtp, pauseBetweenMailsMs: 150 },
      inProduction,
    );

    expect(warning).toContain('SMTP_PAUSE_BETWEEN_MAILS_MS');
    expect(warning).toContain('150');
    expect(warning).toContain(String(SMTP_DEFAULTS.pauseBetweenMailsMs));
  });

  it('stays quiet about a longer pause — that is the careful direction', () => {
    expect(
      smtpWarnings({ ...smtp, pauseBetweenMailsMs: 5000 }, inProduction),
    ).toEqual([]);
  });
});
