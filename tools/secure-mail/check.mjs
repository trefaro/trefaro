/**
 * Sends one real letter through the strict mail server and reads it back.
 *
 * The other half of `probe.mjs`: that one shows what the mail server refuses,
 * this one shows that *this application* gets through it anyway — with a
 * password, over STARTTLS, trusting a certificate that no public authority
 * vouches for, and without a line of code that switches a check off (E62).
 *
 * Creating a participant account is the letter, because it is the shortest
 * double opt-in in the application: an address and a password, no event, no
 * administrative session, nothing seeded. It belongs to the `profiles` core
 * module, which an instance can switch off (E21) — if this answers 404, that
 * is what happened, and the module has to be on for this check to say
 * anything.
 *
 *   node tools/secure-mail/check.mjs
 *
 * Environment: BASE (the server), MAILPIT_URL (the strict one's web API).
 */
const base = process.env.BASE ?? 'http://127.0.0.1:3100';
const mailpit = process.env.MAILPIT_URL ?? 'http://127.0.0.1:8026';
const address = `secure-mail-${Date.now()}@trefaro.test`;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(what, url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let last = 'never answered';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      last = `status ${response.status}`;
    } catch (error) {
      last = error.message;
    }
    await pause(500);
  }
  throw new Error(`${what} did not answer at ${url} (last: ${last})`);
}

await waitFor('the strict mail server', `${mailpit}/api/v1/messages?limit=1`);
await waitFor('the server', `${base}/api/health`);
await fetch(`${mailpit}/api/v1/messages`, { method: 'DELETE' });

const signup = await fetch(`${base}/api/user/profiles`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: address,
    password: 'correct horse battery staple',
    firstName: 'Secure',
    lastName: 'Mail',
  }),
});
// 200 either way (E32); a 503 here means the hand-over itself was refused,
// which is the failure this whole script exists to be able to see.
console.log(`account for ${address}: ${signup.status}`);
if (signup.status === 404) {
  console.error(
    '\nThe `profiles` core module is switched off on this instance, so there ' +
      'is no double opt-in to send. Turn it on and run this again.',
  );
  process.exit(1);
}

const deadline = Date.now() + 30_000;
let message = null;
while (Date.now() < deadline && !message) {
  const response = await fetch(`${mailpit}/api/v1/messages?limit=20`);
  const { messages = [] } = await response.json();
  message = messages.find((mail) =>
    mail.To?.some((to) => to.Address.toLowerCase() === address),
  );
  if (!message) await pause(500);
}

if (!message) {
  console.error(
    `\nNo mail for ${address} reached the strict server. The sign-up may have ` +
      'been accepted and the hand-over refused — read the server log above: a ' +
      'certificate, a password or STARTTLS is missing.',
  );
  process.exit(1);
}

console.log(`delivered  "${message.Subject}"`);
console.log(
  '\nA confirmation mail went through a server that refuses both anonymous ' +
    'and unencrypted submission.',
);
