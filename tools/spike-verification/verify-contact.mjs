/**
 * Verifies the contact loop of FR 3.4 against a *running* deployment.
 *
 * Point 3 of phase 3's Definition of Done is a sentence about an instance, not
 * about a function: **an interested person with no account reaches the
 * organizers, and the answer arrives in their mailbox.** Two halves of the
 * application meet in it that meet nowhere else — the public form of AP 9 and
 * the organizer's inbox of AP 10 — and the second half of the promise leaves
 * the application entirely, so the only place to read it is the mailbox the
 * instance really sent to.
 *
 * Six things get asked, in this order:
 *
 *   1. the form answers `202` with the address it was given, and nothing else
 *      (E10) — it does not say whether anybody will read it;
 *   2. the **organization** is told, in a mail that carries a deep link into
 *      the request rather than into the client's front door (F172);
 *   3. the **guest gets no mail** from having asked. This is the one an open
 *      endpoint has to get right: a form that mails whoever is typed into it
 *      is a way to send mail to strangers from somebody else's server;
 *   4. the request stands in the organizer's overview, as a conversation of
 *      its own with the address on it and waiting for an answer (E39, F133);
 *   5. the answer goes out as mail **and** stays in the history, and the
 *      response says which of the two happened to the mail (F174);
 *   6. the answer really is in the guest's mailbox, with the words that were
 *      typed.
 *
 *   BASE=http://localhost:8080 MAILPIT=http://localhost:8025 \
 *   ADMIN_BOOTSTRAP_EMAIL=… ADMIN_BOOTSTRAP_PASSWORD=… \
 *   node tools/spike-verification/verify-contact.mjs
 *
 * It needs **Mailpit**, because four of the six checks are about mail that was
 * or was not sent. It needs no `docker exec`: everything it creates is one
 * series with one event and no confirmed registration, so the API can delete it
 * again (E14 refuses only what somebody has registered for), and the
 * conversation goes with it.
 *
 * Deliberately **not** dependent on the `chat` module switch: FR 3.4 is P1 and
 * the form hangs on no switch (F171). If this script fails on an instance with
 * `chat` off, that is the finding, not the setup.
 */
const BASE = (
  process.env.BASE ??
  process.env.TREFARO_BASE_URL ??
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');
const MAILPIT = (process.env.MAILPIT ?? 'http://127.0.0.1:8025').replace(
  /\/+$/,
  '',
);
const EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL ?? '';
const PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';
const SESSION_COOKIE = 'trefaro_admin_session';

const stamp = Date.now();
/** The guest's address, unique per run so a mailbox answers for this run only. */
const GUEST = `contact-check-${stamp}@example.org`;
const QUESTION = `Is the venue accessible by wheelchair? (${stamp})`;
const ANSWER = `Yes — step-free from the tram stop. (${stamp})`;

let failures = 0;
let cookie = '';

function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
  );
}

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

/** Every message in the box, newest first — with both parts. */
async function mailsTo(to) {
  const list = await fetch(`${MAILPIT}/api/v1/messages?limit=200`);
  const { messages = [] } = await list.json();
  const mine = messages.filter((message) =>
    (message.To ?? []).some(
      (recipient) => recipient.Address.toLowerCase() === to.toLowerCase(),
    ),
  );
  return Promise.all(
    mine.map(async (message) => {
      const detail = await fetch(`${MAILPIT}/api/v1/message/${message.ID}`);
      const { Subject = '', Text = '', HTML = '' } = await detail.json();
      return { subject: Subject, text: Text, html: HTML };
    }),
  );
}

async function waitForMailTo(to, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [first] = await mailsTo(to);
    if (first) return first;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`no mail for ${to} within ${timeoutMs / 1000}s`);
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
    `${MAILPIT} does not answer (${error.message}). Start Mailpit — four of ` +
      'the six checks below are about mail that was or was not sent.',
  );
  process.exit(1);
}

// --- an administrative session ---------------------------------------------

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

// --- a published event with a page to ask from ------------------------------

const series = await send('POST', '/api/admin/series', {
  name: `Contact verification ${stamp}`,
  description: 'Created by verify-contact.mjs and deleted again at the end.',
  status: 'published',
});
const event = await send('POST', `/api/admin/series/${series.body.id}/events`, {
  name: `Contact verification event ${stamp}`,
  description: 'Created by verify-contact.mjs and deleted again at the end.',
  eventType: 'onsite',
  languages: ['en'],
  startsAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
  endsAt: new Date(Date.now() + 31 * 24 * 3600_000).toISOString(),
  timezone: 'Europe/Berlin',
  venueName: 'Somewhere step-free',
  status: 'published',
});
check(
  'a published event with a landing page',
  series.status === 201 && event.status === 201,
  `series ${series.status}, event ${event.status}`,
);
if (series.status !== 201 || event.status !== 201) process.exit(1);

const path =
  `/api/user/series/${series.body.slug}` + `/events/${event.body.slug}/contact`;

try {
  // --- the guest asks ------------------------------------------------------

  const asked = await call(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Amina Okonkwo',
      email: GUEST,
      body: QUESTION,
    }),
  });
  check(
    'the form answers 202 with the address it was given, and nothing else',
    asked.status === 202 &&
      asked.body?.email === GUEST &&
      Object.keys(asked.body ?? {}).length === 1,
    `status ${asked.status}, body ${JSON.stringify(asked.body)}`,
  );

  // --- the organization hears about it -------------------------------------

  const notice = await waitForMailTo(
    process.env.SERIES_CONTACT_EMAIL ?? (await organizerAddress()),
  );
  check(
    'the organization is told, and the mail names the question',
    notice.text.includes(QUESTION) || notice.html.includes(QUESTION),
    notice.subject,
  );
  check(
    'the notification links into the request, not into the front door (F172)',
    /\/messages\/[0-9a-f-]{36}/.test(`${notice.text}\n${notice.html}`),
    (`${notice.text}\n${notice.html}`.match(/https?:\/\/\S+/) ?? [''])[0],
  );

  // --- and the guest hears nothing at all ----------------------------------

  check(
    'asking sends the guest no mail (an open endpoint may not post to strangers)',
    (await mailsTo(GUEST)).length === 0,
  );

  // --- the request stands in the overview ----------------------------------

  const overview = await send('GET', '/api/admin/conversations?pageSize=50');
  const request = (overview.body?.rows ?? []).find(
    (row) => row.guest?.email?.toLowerCase() === GUEST,
  );
  // "Waiting for an answer" is read from who wrote last rather than from a
  // field, so that the two cannot disagree (F133, `awaitsAnswer` in
  // `shared-models`) — the organization has no membership row and therefore no
  // unread count to read instead.
  check(
    'the request is a conversation of its own, waiting for an answer',
    Boolean(request) &&
      request.type === 'organizer_contact' &&
      request.preview?.senderType === 'guest',
    request
      ? `${request.type}, last written by ${request.preview?.senderType}`
      : `status ${overview.status}`,
  );
  if (!request) throw new Error('the request is not in the overview');

  // --- the organizer answers -----------------------------------------------

  const replied = await send(
    'POST',
    `/api/admin/conversations/${request.id}/messages`,
    { body: ANSWER },
  );
  check(
    'the answer is stored and the mail is reported as sent (F174)',
    replied.status === 201 && replied.body?.delivery === 'sent',
    `status ${replied.status}, delivery ${replied.body?.delivery}`,
  );

  const history = await send(
    'GET',
    `/api/admin/conversations/${request.id}/messages`,
  );
  // `rows`, newest first, and no total — nothing shows a message count.
  const lines = history.body?.rows ?? [];
  check(
    'the answer stays in the history beside the question',
    lines.some((line) => line.body === ANSWER) &&
      lines.some((line) => line.body === QUESTION),
    `${lines.length} line(s)`,
  );

  // --- and it arrives ------------------------------------------------------

  const answer = await waitForMailTo(GUEST);
  check(
    'the answer is in the mailbox of somebody who has no account',
    answer.text.includes(ANSWER) || answer.html.includes(ANSWER),
    answer.subject,
  );
} finally {
  // Nothing was registered for, so the series can go — and it takes the event
  // and the conversation with it (E14 refuses only what people registered for).
  const removed = await send('DELETE', `/api/admin/series/${series.body.id}`);
  check(
    'the instance is as it was found',
    removed.status === 204,
    `DELETE answered ${removed.status}`,
  );
}

/**
 * Where a notification to the organization goes.
 *
 * The contact address of the series if it has one, and the instance's sender
 * address otherwise (F172) — this script creates a series without one, so it is
 * the second case. Read from the instance rather than guessed, because a
 * deployment configures its own `SMTP_FROM`.
 */
async function organizerAddress() {
  const config = await send('GET', '/api/admin/config');
  return (
    config.body?.contactEmail ??
    config.body?.senderEmail ??
    process.env.SMTP_FROM ??
    'trefaro@example.org'
  );
}

console.log(
  failures === 0
    ? '\nAll checks passed. A stranger reached the organizers, and the answer ' +
        'left the application.'
    : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
