/**
 * Verifies the administrative access boundary against a *running* instance
 * (FR 1.2, FR 1.3).
 *
 * Everything here is also covered by `apps/server-e2e` — except the login rate
 * limit, which is the reason this script exists: exercising it blocks the login
 * route for fifteen minutes, which would make the automated suite
 * unrepeatable. Run this deliberately, and expect the instance's login to be
 * locked out afterwards.
 *
 *   node tools/spike-verification/verify-admin-access.mjs
 *
 * Reads ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD from the
 * environment — the same pair the server booted with.
 */
const BASE = process.env.TREFARO_BASE_URL ?? 'http://127.0.0.1:3000';
const SESSION_COOKIE = 'trefaro_admin_session';
const EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL;
const PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD;

/** Attempts allowed on the login before it starts blocking. See AuthController. */
const LOGIN_ATTEMPT_LIMIT = 20;

let failures = 0;

function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
  );
}

async function call(path, init) {
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

const postJson = (path, payload, init = {}) =>
  call(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    body: JSON.stringify(payload),
  });

function sessionCookie(headers) {
  for (const header of headers.getSetCookie()) {
    const [pair] = header.split(';');
    const [key, ...rest] = pair.split('=');
    if (key.trim() === SESSION_COOKIE) return rest.join('=');
  }
  return null;
}

if (!EMAIL || !PASSWORD) {
  console.error(
    'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set to the pair the server booted with.',
  );
  process.exit(2);
}

// --- the boundary ----------------------------------------------------------

check(
  'the administrator list needs a session',
  (await call('/api/admin/admins')).status === 401,
);

check(
  "a plug-in's administrative endpoint needs one too",
  (
    await call(
      '/api/admin/plugins/room-planning/events/11111111-1111-4111-8111-111111111111/rooms',
    )
  ).status === 401,
);

check(
  'the public configuration still answers',
  (await call('/api/config')).status === 200,
);

// --- logging in ------------------------------------------------------------

const login = await postJson('/api/admin/auth/login', {
  email: EMAIL,
  password: PASSWORD,
});
check(
  'the right credentials are accepted',
  login.status === 200,
  `status ${login.status}`,
);

const token = sessionCookie(login.headers);
check('a session cookie is handed out', Boolean(token));

const attributes = (
  login.headers
    .getSetCookie()
    .find((h) => h.startsWith(`${SESSION_COOKIE}=`)) ?? ''
).toLowerCase();
check('the cookie is HttpOnly', attributes.includes('httponly'));
check('the cookie is SameSite=Lax', attributes.includes('samesite=lax'));

const cookie = { cookie: `${SESSION_COOKIE}=${token}` };
check(
  'the session works',
  (await call('/api/admin/auth/me', { headers: cookie })).status === 200,
);

// --- the rate limit, the part the automated suite cannot afford ------------

console.log(
  `\nExercising the login rate limit — ${LOGIN_ATTEMPT_LIMIT} attempts are allowed, ` +
    'and the route will be blocked for fifteen minutes afterwards.',
);

let blockedAfter = null;
for (let attempt = 1; attempt <= LOGIN_ATTEMPT_LIMIT + 2; attempt += 1) {
  const response = await postJson('/api/admin/auth/login', {
    email: EMAIL,
    password: 'deliberately-wrong',
  });
  if (response.status === 429) {
    blockedAfter ??= attempt;
  }
}

check(
  'guessing gets throttled',
  blockedAfter !== null,
  blockedAfter ? `blocked from attempt ${blockedAfter}` : 'never blocked',
);

check(
  'an established session survives the block',
  (await call('/api/admin/auth/me', { headers: cookie })).status === 200,
);

// Leave the instance without a live session from this run.
await call('/api/admin/auth/logout', { method: 'POST', headers: cookie });

console.log(
  failures === 0
    ? '\nAll checks passed. The login is blocked for the next fifteen minutes.'
    : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
