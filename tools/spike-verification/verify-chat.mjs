/**
 * Verifies the real-time chat against a *running* deployment (FR 4.5, E41).
 *
 * This replaces the socket probe of phase 0. That one emitted `chat:echo` and
 * checked that the same string came back, which proved a WebSocket upgrade and
 * nothing else — and the handler it needed had no business surviving into a
 * release. What AP 7 of phase 3 has to show instead is the sentence its
 * acceptance criterion is written in: **a message arrives at both people
 * without a reload, through the reverse proxy.** No unit test and no contract
 * test can show that, because both of them talk to a server directly.
 *
 * Five things get asked, in this order:
 *
 *   1. a handshake without a cookie is refused — and the refusal is itself the
 *      proof that the upgrade survived whatever is in between: it is the
 *      server's own sentence, and it arrived over the socket;
 *   2. a handshake with a session connects, on the `websocket` transport and
 *      not on long-polling;
 *   3. a room that is not the asker's cannot be joined;
 *   4. a message written over REST reaches **both** sockets;
 *   5. marking the conversation as read reaches the other side.
 *
 *   BASE=http://localhost:8080 MAILPIT=http://localhost:8025 \
 *   node tools/spike-verification/verify-chat.mjs
 *
 * It needs **Mailpit**, because an account is only usable after its double
 * opt-in (E32) and the confirmation token exists only in the mail that was
 * sent. It needs `docker exec` into the database container, because there is
 * no endpoint that deletes a participant account — by design (erasure is
 * phase 5 work) — and a verification script that leaves two accounts and a
 * conversation behind on every run is not a check, it is litter. The two
 * accounts also cost two of the twenty logins per five minutes the instance
 * allows (E4).
 */
import { execFileSync } from 'node:child_process';
import { io } from 'socket.io-client';

const BASE = (
  process.env.BASE ??
  process.env.SOCKET_BASE ??
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');
const MAILPIT = (process.env.MAILPIT ?? 'http://127.0.0.1:8025').replace(
  /\/+$/,
  '',
);
const POSTGRES_CONTAINER = process.env.POSTGRES_CONTAINER ?? 'trefaro-postgres';
const DATABASE_USER = process.env.DATABASE_USER ?? 'trefaro';
const DATABASE_NAME = process.env.DATABASE_NAME ?? 'trefaro';

/** Kept in step with `libs/shared-models`: the socket lives inside `/api`. */
const REALTIME_PATH = '/api/socket.io';
const CHAT_NAMESPACE = '/chat';
const USER_SESSION_COOKIE = 'trefaro_user_session';
const PASSWORD = 'a-long-enough-passphrase';

/** Unique per run, and the pattern the cleanup deletes by. */
const stamp = Date.now();
const DOMAIN = `chatcheck.${stamp}.example.org`;

let failures = 0;

function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
  );
}

function psql(sql) {
  return execFileSync('docker', [
    'exec',
    POSTGRES_CONTAINER,
    'psql',
    '-U',
    DATABASE_USER,
    '-d',
    DATABASE_NAME,
    '-At',
    '-c',
    sql,
  ])
    .toString()
    .trim();
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

const postJson = (path, payload, cookie = '') =>
  call(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(payload),
  });

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
      const { Text = '' } = await detail.json();
      return Text;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`no mail for ${to} within ${timeoutMs / 1000}s`);
}

/** Registers, confirms, logs in and opts in — the whole way to a session. */
async function account(handle, firstName, lastName) {
  const email = `${handle}@${DOMAIN}`;

  const created = await postJson('/api/user/profiles', {
    email,
    password: PASSWORD,
    firstName,
    lastName,
  });
  if (created.status >= 400) {
    throw new Error(
      `could not register ${email}: ${created.status} ${JSON.stringify(created.body)}`,
    );
  }

  const mail = await waitForMail(email);
  const link = /profile\/confirm\?token=([A-Za-z0-9_.%-]+)/.exec(mail);
  if (!link) throw new Error(`no confirmation link in the mail to ${email}`);
  await postJson('/api/user/profiles/confirm', {
    token: decodeURIComponent(link[1]),
  });

  const login = await postJson('/api/participant/auth/login', {
    email,
    password: PASSWORD,
  });
  if (login.status !== 200) {
    throw new Error(
      `could not sign in as ${email}: ${login.status} — a 429 here is the ` +
        `login budget of E4, not a broken login`,
    );
  }

  const setCookie = login.headers.getSetCookie?.() ?? [];
  const session = setCookie
    .map((value) => value.split(';')[0])
    .find((value) => value.startsWith(`${USER_SESSION_COOKIE}=`));
  if (!session) throw new Error(`no session cookie for ${email}`);

  // Being written to is the same switch as being found (E37).
  await call('/api/participant/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: session },
    body: JSON.stringify({ searchable: true }),
  });

  return { email, cookie: session, id: login.body.participant.id };
}

/**
 * Opens a socket and collects what arrives on it.
 *
 * `extraHeaders` is where a Node client puts the cookie a browser would attach
 * on its own — which is the whole reason the endpoint sits under `/api`.
 */
function open(cookie) {
  const socket = io(`${BASE}${CHAT_NAMESPACE}`, {
    path: REALTIME_PATH,
    // No polling fallback: if the upgrade does not survive the path under
    // test, this must fail rather than quietly degrade.
    transports: ['websocket'],
    reconnection: false,
    timeout: 8000,
    ...(cookie ? { extraHeaders: { cookie } } : {}),
    // The same escape hatch the rest of a run gets from
    // NODE_TLS_REJECT_UNAUTHORIZED: the websocket client keeps its own TLS
    // options, so without this a self-signed trial certificate fails the
    // handshake and reads as "the proxy does not pass upgrades".
    rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
  });

  const inbox = { messages: [], reads: [], conversations: [] };
  socket.on('chat:message', (event) => inbox.messages.push(event));
  socket.on('chat:read', (event) => inbox.reads.push(event));
  socket.on('chat:conversation', (event) => inbox.conversations.push(event));

  const settled = new Promise((resolve) => {
    socket.once('connect', () => resolve({ connected: true }));
    socket.once('connect_error', (error) =>
      resolve({ connected: false, message: error.message }),
    );
    setTimeout(() => resolve({ connected: false, message: 'timeout' }), 9000);
  });

  return { socket, inbox, settled };
}

const join = (socket, conversationId) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ joined: false }), 5000);
    socket.emit('chat:join', conversationId, (ack) => {
      clearTimeout(timer);
      resolve(ack ?? { joined: false });
    });
  });

/** Waits for something to land, so a check does not race the socket. */
async function settle(condition, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

console.log(`--- the chat through ${BASE} ---`);

const mailpit = await fetch(`${MAILPIT}/api/v1/messages?limit=1`).catch(
  (error) => ({ ok: false, error }),
);
if (!mailpit.ok) {
  console.log(
    `FAIL  Mailpit answers at ${MAILPIT} — an account cannot be confirmed ` +
      `without the mail that carries its token (E32)`,
  );
  process.exit(1);
}

const amina = await account('amina', 'Amina', 'Okonkwo');
const bo = await account('bo', 'Bo', 'Adeyemi');
console.log(`      two accounts under @${DOMAIN}`);

const opened = await postJson(
  '/api/participant/conversations',
  { profileId: bo.id },
  amina.cookie,
);
check('a conversation can be opened over REST', opened.status === 200);
const conversationId = opened.body?.id;

// --- 1. the door ---------------------------------------------------------
const anonymous = open('');
const refusal = await anonymous.settled;
check(
  'a handshake without a session is refused',
  !refusal.connected,
  refusal.message,
);
check(
  'and the refusal is the server’s own sentence, so frames travelled both ways',
  /session/i.test(refusal.message ?? ''),
  refusal.message,
);
anonymous.socket.disconnect();

// --- 2. the two sockets --------------------------------------------------
const first = open(amina.cookie);
const second = open(bo.cookie);
const [one, two] = await Promise.all([first.settled, second.settled]);

check('a handshake with a session connects', one.connected, one.message);
check('and so does the other side’s', two.connected, two.message);
check(
  'it is a real upgrade, not long-polling',
  first.socket.io?.engine?.transport?.name === 'websocket',
  first.socket.io?.engine?.transport?.name,
);

if (one.connected && two.connected && conversationId) {
  // --- 3. the rooms ------------------------------------------------------
  const stranger = await join(
    first.socket,
    '5f2a6d1e-0000-4000-8000-000000000000',
  );
  check('a room that is not the asker’s cannot be joined', !stranger.joined);

  const mine = await join(first.socket, conversationId);
  const theirs = await join(second.socket, conversationId);
  check('both members join their conversation', mine.joined && theirs.joined);

  // --- 4. a message reaches both ----------------------------------------
  const text = `Through the proxy at ${new Date().toISOString()}`;
  const sent = await postJson(
    `/api/participant/conversations/${conversationId}/messages`,
    { body: text },
    amina.cookie,
  );
  check('the message is accepted', sent.status === 201, String(sent.status));

  const arrived = await settle(
    () => first.inbox.messages.length > 0 && second.inbox.messages.length > 0,
  );
  check('the message arrives at both participants without a reload', arrived);
  check(
    'and it is the message that was sent',
    second.inbox.messages[0]?.body === text,
    second.inbox.messages[0]?.body,
  );
  check(
    'both are told their conversation moved, for the list',
    await settle(
      () =>
        first.inbox.conversations.length > 0 &&
        second.inbox.conversations.length > 0,
    ),
  );

  // --- 5. the read receipt ----------------------------------------------
  await call(`/api/participant/conversations/${conversationId}/read`, {
    method: 'PUT',
    headers: { cookie: bo.cookie },
  });
  check(
    'a read receipt reaches the other side',
    await settle(() => first.inbox.reads.length > 0),
    JSON.stringify(first.inbox.reads[0] ?? null),
  );
}

first.socket.disconnect();
second.socket.disconnect();

// --- cleanup -------------------------------------------------------------
//
// The order F158 spells out: the conversation first, because deleting an
// attachment would empty a picture-only message. There are no pictures here,
// and keeping the order in one place is cheaper than remembering when it
// matters. The memberships carry no foreign key on the account (E39), so
// deleting the profiles would leave the conversation standing.
try {
  if (conversationId) {
    psql(`delete from conversation where id = '${conversationId}'`);
  }
  psql(`delete from user_profile where email like '%@${DOMAIN}'`);
  console.log(`      cleaned up the two accounts and the conversation`);
} catch (error) {
  console.log(
    `WARN  could not clean up (${error.message}). Two accounts under ` +
      `@${DOMAIN} are still in the database.`,
  );
}

console.log(
  `\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`,
);
process.exit(failures === 0 ? 0 : 1);
