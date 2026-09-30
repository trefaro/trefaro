/**
 * What the strict mail server refuses, and what it accepts.
 *
 * Three conversations against `mailpit-secure`, in the order that makes the
 * point: without encryption, with encryption but without a password, and with
 * both. The first two have to fail — otherwise the server is not the strict one
 * and the check the server passes next means nothing (E62).
 *
 * Deliberately nodemailer rather than this application's own mailer: what is
 * being characterized here is the *mail server*, and using the library directly
 * is the only way to ask it a question our code refuses to ask — "may I send
 * this in the clear?" There is no option in `SmtpMailer` for that, which is the
 * point of it.
 *
 *   node tools/secure-mail/probe.mjs
 *
 * Environment: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD — the same names
 * the server reads, so one export serves both.
 */
import { createTransport } from 'nodemailer';

const host = process.env.SMTP_HOST ?? '127.0.0.1';
const port = Number(process.env.SMTP_PORT ?? 1026);
const user = process.env.SMTP_USER ?? 'trefaro';
const pass = process.env.SMTP_PASSWORD ?? 'mailpit-development-password';

const message = {
  from: 'Probe <probe@trefaro.test>',
  to: 'nobody@trefaro.test',
  subject: 'probe',
  text: 'probe',
};

async function attempt(what, options) {
  const transport = createTransport({ host, port, ...options });
  try {
    await transport.sendMail(message);
    return { what, accepted: true };
  } catch (error) {
    return { what, accepted: false, reason: error.message.split('\n')[0] };
  } finally {
    transport.close();
  }
}

const results = [
  await attempt('unencrypted, unauthenticated', {
    secure: false,
    ignoreTLS: true,
  }),
  await attempt('encrypted, unauthenticated', {
    secure: false,
    requireTLS: true,
  }),
  await attempt('encrypted and authenticated', {
    secure: false,
    requireTLS: true,
    auth: { user, pass },
  }),
];

for (const result of results) {
  console.log(
    `${result.accepted ? 'accepted' : 'refused '}  ${result.what}` +
      (result.reason ? `  — ${result.reason}` : ''),
  );
}

const [plain, anonymous, proper] = results;
if (plain.accepted || anonymous.accepted || !proper.accepted) {
  console.error(
    '\nThis is not a strict mail server: it has to refuse the first two and ' +
      'accept the third. Check the flags in infra/docker-compose.dev.yml.',
  );
  process.exit(1);
}
console.log('\nThe mail server refuses what E62 says it must refuse.');
