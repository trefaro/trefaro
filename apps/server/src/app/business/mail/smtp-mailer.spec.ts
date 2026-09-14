import { createTransport } from 'nodemailer';
import type { TrefaroEnv } from '../../core/config/env';
import type { SmtpEnv } from '../../core/config/smtp';
import { TemporaryMailFailure } from './ports/mailer';
import { SmtpMailer } from './smtp-mailer';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const smtp: SmtpEnv = {
  host: 'mail.example.org',
  port: 587,
  secure: false,
  requireTls: true,
  user: 'trefaro',
  password: 'mail-secret',
  from: 'Example NGO <events@example.org>',
  pauseBetweenMailsMs: 1000,
};

const message = {
  to: 'someone@example.org',
  subject: 'Hello',
  text: 'Hello',
  html: '<p>Hello</p>',
};

/** The nodemailer error shape: an SMTP reply code on an ordinary Error. */
function rejection(responseCode: number): Error {
  return Object.assign(new Error(`${responseCode} try again`), {
    responseCode,
  });
}

describe('SmtpMailer', () => {
  const sendMail = jest.fn();
  const transports = jest.mocked(createTransport);

  const mailerFor = (overrides: Partial<SmtpEnv> = {}): SmtpMailer =>
    new SmtpMailer({ smtp: { ...smtp, ...overrides } } as TrefaroEnv);

  /** The options the transport was created with. */
  const transportOptions = (): Record<string, unknown> =>
    transports.mock.calls[0][0] as Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    sendMail.mockResolvedValue({ messageId: '<id@example.org>' });
    transports.mockReturnValue({ sendMail } as never);
  });

  it('insists on an encrypted connection when the instance does', async () => {
    await mailerFor().send(message);

    expect(transportOptions()).toMatchObject({
      host: 'mail.example.org',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'trefaro', pass: 'mail-secret' },
    });
  });

  /*
   * The one line E62 forbids, and the reason this test exists rather than a
   * comment: an unreachable certificate is a frustrating half hour, and
   * `rejectUnauthorized: false` ends it — which is exactly why nobody must be
   * able to add it without a test going red. A test mail server is trusted
   * through NODE_EXTRA_CA_CERTS, outside this process.
   */
  it('never switches certificate verification off', async () => {
    await mailerFor().send(message);

    const options = transportOptions();
    expect(options).not.toHaveProperty('tls');
    expect(options).not.toHaveProperty('ignoreTLS');
    expect(JSON.stringify(options)).not.toContain('rejectUnauthorized');
  });

  it('submits anonymously when the instance has no credentials', async () => {
    await mailerFor({ user: null, password: null }).send(message);

    expect(transportOptions()['auth']).toBeUndefined();
  });

  it('hands over the headers a message brings with it', async () => {
    await mailerFor().send({
      ...message,
      headers: { 'List-Unsubscribe': '<https://events.example.org/x>' },
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'List-Unsubscribe': '<https://events.example.org/x>' },
      }),
    );
  });

  // "Not now" and "never" are different answers, and only the sender of two
  // hundred invitations can act on the difference (F56).
  it('marks a 4xx reply as temporary', async () => {
    sendMail.mockRejectedValue(rejection(451));

    await expect(mailerFor().send(message)).rejects.toBeInstanceOf(
      TemporaryMailFailure,
    );
  });

  it('leaves a 5xx reply as the refusal it is', async () => {
    sendMail.mockRejectedValue(rejection(550));

    await expect(mailerFor().send(message)).rejects.not.toBeInstanceOf(
      TemporaryMailFailure,
    );
  });

  // A connection that never opened is not a rejection. Treating it as one
  // would double the work of every recipient while the mail server is down.
  it('leaves a connection failure as it is', async () => {
    sendMail.mockRejectedValue(
      Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNECTION' }),
    );

    await expect(mailerFor().send(message)).rejects.not.toBeInstanceOf(
      TemporaryMailFailure,
    );
  });
});
