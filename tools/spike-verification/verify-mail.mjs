/**
 * Verifies the four mails against a *running* deployment (chapter 4, E22, E24).
 *
 * AP 10 of phase 2 took the mail text out of TypeScript and put it in the
 * catalogue an organization maintains. Two things follow that no unit test can
 * show, because both are about an instance rather than about a function:
 *
 *   1. **A word changes without a rebuild.** The acceptance criterion of the
 *      work package is an organization editing the subject of the confirmation
 *      mail; this script edits it through the API and then makes the instance
 *      send one.
 *   2. **A mail falls back as a whole** (E24). A language with one sentence
 *      translated must produce a completely English letter, not a mixed one.
 *      That needs a partly translated language, an instance configured to it,
 *      and a real message — which is three states no fixture has.
 *
 * It also reads all four letters out of Mailpit and looks at what arrived: the
 * subject the catalogue promises, the link each of them exists for, no
 * placeholder left standing, and nothing loaded from anywhere when the mail is
 * opened (NFR 9).
 *
 *   BASE=http://localhost:8080 MAILPIT=http://localhost:8025 \
 *   ADMIN_BOOTSTRAP_EMAIL=… ADMIN_BOOTSTRAP_PASSWORD=… \
 *   node tools/spike-verification/verify-mail.mjs
 *
 * It restores what it found: the language it borrows (`ia`, Interlingua) is one
 * no image ships and no suite touches, the instance's own language settings are
 * written back, and the series it creates is deleted at the end — registrations
 * first, because a series with confirmed registrations refuses to be (E14).
 */
const BASE = (process.env.BASE ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
const MAILPIT = (process.env.MAILPIT ?? 'http://127.0.0.1:8025').replace(
  /\/+$/,
  '',
);
/**
 * The language to hold the instance to for one run.
 *
 * Without it the script checks the language the instance is actually configured
 * in, which is the honest default. With it — `LOCALE=de` — the instance is
 * switched for the duration and switched back, which is how the acceptance
 * criterion "the four mails look right in both languages" gets checked on a
 * deployment whose own language is only one of them.
 */
const LOCALE = process.env.LOCALE ?? '';
const EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL ?? '';
const PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';
const SESSION_COOKIE = 'trefaro_admin_session';

/** A language no image ships, translated just enough to prove E24. */
const PARTIAL_LOCALE = 'ia';
const PARTIAL_SUBJECT = 'Confirma tu inscription (verification)';
const PROBE_SUBJECT = 'One more click and you are in (verification)';

const stamp = Date.now();
const address = (what) => `mailcheck.${what}.${stamp}@example.org`;

let failures = 0;

function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
  );
}

let cookie = '';

async function call(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, init);
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: response.status, body, headers: response.headers };
}

function send(method, path, payload) {
  return call(path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
}

/** The same interpolation the server does, so a subject can be predicted. */
function fill(template, params) {
  return String(template ?? '').replace(/{{\s*([^}\s]+)\s*}}/g, (raw, name) =>
    name in params ? String(params[name]) : raw,
  );
}

/** The newest message to an address, with both parts. */
async function waitForMail(to, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = await fetch(`${MAILPIT}/api/v1/messages?limit=200`);
    const { messages = [] } = await list.json();
    const found = messages.find((message) =>
      (message.To ?? []).some(
        (recipient) => recipient.Address.toLowerCase() === to.toLowerCase(),
      ),
    );
    if (found) {
      const detail = await fetch(`${MAILPIT}/api/v1/message/${found.ID}`);
      const { Subject = '', Text = '', HTML = '' } = await detail.json();
      return { subject: Subject, text: Text, html: HTML };
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`no mail for ${to} within ${timeoutMs / 1000}s`);
}

/** Every mail is held to these, whatever it says and in whatever language. */
function inspect(label, mail) {
  check(
    `${label}: no placeholder is left standing`,
    !/{{/.test(`${mail.subject}\n${mail.text}\n${mail.html}`),
    mail.subject,
  );
  check(
    `${label}: loads nothing when it is opened (NFR 9)`,
    !/<img|<link|@import|url\(/i.test(mail.html),
  );
  check(
    `${label}: has a text part as well as HTML`,
    mail.text.trim().length > 0,
  );
}

async function register(to, series, event, firstName = 'Mail') {
  const response = await call(
    `/api/user/series/${series}/events/${event}/registrations`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName,
        lastName: 'Verification',
        email: to,
        newsletterOptIn: false,
        customFields: {},
      }),
    },
  );
  if (response.status >= 400) {
    throw new Error(`registration failed: ${response.status}`);
  }
}

if (!EMAIL || !PASSWORD) {
  console.log(
    'This script needs an administrator: set ADMIN_BOOTSTRAP_EMAIL and ' +
      'ADMIN_BOOTSTRAP_PASSWORD.',
  );
  process.exit(1);
}

try {
  const probe = await fetch(`${MAILPIT}/api/v1/messages?limit=1`);
  if (!probe.ok) throw new Error(String(probe.status));
} catch (error) {
  console.log(
    `${MAILPIT} does not answer (${error.message}). Start Mailpit — nothing ` +
      'below can be checked without the messages the instance actually sent.',
  );
  process.exit(1);
}

const login = await send('POST', '/api/admin/auth/login', {
  email: EMAIL,
  password: PASSWORD,
});
for (const header of login.headers.getSetCookie()) {
  const [pair] = header.split(';');
  const [key, ...rest] = pair.split('=');
  if (key.trim() === SESSION_COOKIE)
    cookie = `${SESSION_COOKIE}=${rest.join('=')}`;
}
check(
  'an administrative session is established',
  Boolean(cookie),
  `status ${login.status}`,
);
if (!cookie) process.exit(1);

const overview = await send('GET', '/api/admin/i18n');
const stored = {
  defaultLocale: overview.body?.defaultLocale ?? 'en',
  activeLocales: (overview.body?.locales ?? [])
    .filter((row) => row.active)
    .map((row) => row.locale),
};
if (LOCALE && LOCALE !== stored.defaultLocale) {
  const switched = await send('PUT', '/api/admin/config/locales', {
    defaultLocale: LOCALE,
    activeLocales: [...new Set([...stored.activeLocales, LOCALE])],
  });
  check(
    `the instance is put into ${LOCALE} for this run`,
    switched.status === 200,
    `status ${switched.status}`,
  );
}

const DEFAULT = LOCALE || stored.defaultLocale;
const catalogue = (await call(`/api/i18n/${DEFAULT}`)).body ?? {};
const english = (await call('/api/i18n/en')).body ?? {};

check(
  'the mail text is in the catalogue this instance serves',
  typeof catalogue['mail.confirm.subject'] === 'string' &&
    typeof catalogue['mail.invitation.footer'] === 'string',
  `default locale ${DEFAULT}`,
);

// --- something to register for ---------------------------------------------

const series = await send('POST', '/api/admin/series', {
  name: `Mail verification ${stamp}`,
  description: 'Created by verify-mail.mjs and deleted again at the end.',
  status: 'published',
});
const event = await send('POST', `/api/admin/series/${series.body.id}/events`, {
  name: `Mail verification event ${stamp}`,
  description: 'Created by verify-mail.mjs and deleted again at the end.',
  eventType: 'onsite',
  languages: ['en'],
  startsAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
  endsAt: new Date(Date.now() + 31 * 24 * 3600_000).toISOString(),
  timezone: 'Europe/Berlin',
  venueName: 'Somewhere',
  status: 'published',
});
check(
  'a published event to register for',
  series.status === 201 && event.status === 201,
  `series ${series.status}, event ${event.status}`,
);

const seriesSlug = series.body.slug;
const eventSlug = event.body.slug;
const eventName = event.body.name;
const created = [];

try {
  // --- 1. the confirmation request -----------------------------------------

  const first = address('confirm');
  await register(first, seriesSlug, eventSlug);
  const confirmation = await waitForMail(first);

  check(
    'the confirmation request carries the subject from the catalogue',
    confirmation.subject ===
      fill(catalogue['mail.confirm.subject'], { event: eventName }),
    confirmation.subject,
  );
  check(
    'and the link it exists for (E5b)',
    /\/registrations\/confirm\?token=/.test(confirmation.text),
  );
  inspect('confirmation request', confirmation);

  // --- 2. the receipt -------------------------------------------------------

  const token = /registrations\/confirm\?token=([A-Za-z0-9_.%-]+)/.exec(
    confirmation.text,
  )?.[1];
  await call('/api/user/registrations/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: decodeURIComponent(token ?? '') }),
  });
  const receipt = await waitForMail(first);

  check(
    'the receipt carries its own subject from the catalogue',
    receipt.subject ===
      fill(catalogue['mail.receipt.subject'], { event: eventName }),
    receipt.subject,
  );
  check(
    'and the personal link self-service runs on (E11)',
    /\/registrations\/me\?token=/.test(receipt.text),
  );
  inspect('receipt', receipt);

  // --- 3. the cancellation notice ------------------------------------------

  const rows = await send(
    'GET',
    `/api/admin/events/${event.body.id}/registrations?search=${encodeURIComponent(first)}`,
  );
  const registrationId = rows.body?.rows?.[0]?.id;
  created.push(registrationId);
  await send('PATCH', `/api/admin/registrations/${registrationId}`, {
    status: 'cancelled',
  });
  const cancelled = await waitForMail(first);

  check(
    'the cancellation notice says which event, in the catalogue’s words (F59)',
    cancelled.subject ===
      fill(catalogue['mail.cancelled.subject'], { event: eventName }),
    cancelled.subject,
  );
  check(
    'and offers no objection link — it is not an invitation',
    !/\/invitations\/unsubscribe/.test(cancelled.text),
  );
  inspect('cancellation notice', cancelled);

  // --- 4. the invitation ----------------------------------------------------

  const invitee = address('invited');
  await register(invitee, seriesSlug, eventSlug, 'Invited');
  const second = await waitForMail(invitee);
  const secondToken = /registrations\/confirm\?token=([A-Za-z0-9_.%-]+)/.exec(
    second.text,
  )?.[1];
  await call('/api/user/registrations/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: decodeURIComponent(secondToken ?? '') }),
  });
  await waitForMail(invitee);

  const contacts = await send(
    'GET',
    `/api/admin/series/${series.body.id}/contacts?pageSize=20`,
  );
  const recipient = (contacts.body?.rows ?? []).find(
    (row) => row.email.toLowerCase() === invitee.toLowerCase(),
  );
  const invitation = await send(
    'POST',
    `/api/admin/series/${series.body.id}/invitations`,
    {
      subject: `An invitation written by a person ${stamp}`,
      body: 'we would be glad to see you again.\n\nThe programme is online.',
      eventId: event.body.id,
      recipients: [recipient?.registrationId],
    },
  );
  check(
    'the invitation is accepted as a job, not as a request (F56)',
    invitation.status === 202,
    `status ${invitation.status}`,
  );

  // The receipt is already in the box for this address, so the invitation is
  // recognised by the subject the organizer wrote — which is the point of the
  // check that follows.
  let letter = null;
  for (let attempt = 0; attempt < 100 && !letter; attempt += 1) {
    const list = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${invitee}`)}&limit=50`,
    );
    const { messages = [] } = await list.json();
    const match = messages.find((message) =>
      message.Subject.includes(`written by a person ${stamp}`),
    );
    if (match) {
      const detail = await fetch(`${MAILPIT}/api/v1/message/${match.ID}`);
      const { Subject, Text = '', HTML = '' } = await detail.json();
      letter = { subject: Subject, text: Text, html: HTML };
    } else {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  check('the invitation arrives', Boolean(letter));
  if (letter) {
    check(
      'with the subject the organizer wrote, untranslated',
      letter.subject === `An invitation written by a person ${stamp}`,
      letter.subject,
    );
    check(
      'and the footer that makes writing to it legitimate (E15, F58)',
      letter.text.includes(
        fill(catalogue['mail.invitation.footer'], {
          series: `Mail verification ${stamp}`,
        }),
      ) && /\/invitations\/unsubscribe\?token=/.test(letter.text),
    );
    inspect('invitation', letter);
  }

  // --- 5. a word changes without a rebuild ---------------------------------

  await send('PUT', `/api/admin/i18n/${DEFAULT}`, {
    entries: { 'mail.confirm.subject': PROBE_SUBJECT },
  });
  const reworded = address('reworded');
  await register(reworded, seriesSlug, eventSlug, 'Reworded');
  const afterEdit = await waitForMail(reworded);

  check(
    'an edited subject reaches the next mail, with no rebuild and no restart',
    afterEdit.subject === PROBE_SUBJECT,
    afterEdit.subject,
  );

  await send(
    'DELETE',
    `/api/admin/i18n/${DEFAULT}/${encodeURIComponent('mail.confirm.subject')}`,
  );

  // --- 6. E24: a partly translated language sends a whole English letter ----

  await send('PUT', `/api/admin/i18n/${PARTIAL_LOCALE}`, {
    entries: { 'mail.confirm.subject': PARTIAL_SUBJECT },
  });
  await send('PUT', '/api/admin/config/locales', {
    defaultLocale: PARTIAL_LOCALE,
    activeLocales: [...stored.activeLocales, PARTIAL_LOCALE],
  });

  const partial = address('partial');
  await register(partial, seriesSlug, eventSlug, 'Partial');
  const fallenBack = await waitForMail(partial);

  check(
    'a language with one sentence translated sends no mail in it (E24)',
    fallenBack.subject !== PARTIAL_SUBJECT,
    fallenBack.subject,
  );
  check(
    'the whole letter is English instead, subject included',
    fallenBack.subject ===
      fill(english['mail.confirm.subject'], { event: eventName }),
    fallenBack.subject,
  );
  check(
    'and its body too — not one English paragraph in a foreign letter',
    fallenBack.text.includes(english['mail.confirm.step']) &&
      fallenBack.text.includes(
        fill(english['mail.greeting'], { name: 'Partial' }),
      ),
  );
  inspect('fallback letter', fallenBack);
} finally {
  await send('PUT', '/api/admin/config/locales', stored);
  await send(
    'DELETE',
    `/api/admin/i18n/${PARTIAL_LOCALE}/${encodeURIComponent('mail.confirm.subject')}`,
  );
  await send(
    'DELETE',
    `/api/admin/i18n/${DEFAULT}/${encodeURIComponent('mail.confirm.subject')}`,
  );

  // Registrations first: a series with confirmed registrations refuses to be
  // deleted (E14), and this script has just made several.
  const all = await send(
    'GET',
    `/api/admin/events/${event.body?.id}/registrations?pageSize=200`,
  );
  for (const row of all.body?.rows ?? []) {
    await send('DELETE', `/api/admin/registrations/${row.id}`);
  }
  await send('DELETE', `/api/admin/events/${event.body?.id}`);
  await send('DELETE', `/api/admin/series/${series.body?.id}`);
}

const restored = await send('GET', '/api/admin/i18n');
check(
  'this script leaves the instance as it found it',
  restored.body?.defaultLocale === stored.defaultLocale &&
    !(restored.body?.locales ?? []).some(
      (row) => row.locale === PARTIAL_LOCALE && row.translated > 0,
    ),
  `default ${restored.body?.defaultLocale}`,
);

console.log(
  failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
