/**
 * Verifies the first-run setup against a *fresh* instance (FR 1.1, NFR 15, E28).
 *
 * This is the one check no suite in this repository can perform. The setup
 * endpoints exist only while `admin_user` is empty; every automated suite runs
 * against an instance created from `ADMIN_BOOTSTRAP_*`, and the last
 * administrator cannot be deleted — which is exactly the property that makes the
 * state unreachable from a test. So the happy path is proven here, once, against
 * a stack that has never been set up.
 *
 *   # 1. Start a stack with ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD
 *   #    empty, against an empty database volume.
 *   docker compose --env-file .env -p trefaro-fresh \
 *                  -f infra/docker-compose.yml up -d --build
 *
 *   # 2. Take the token out of the server's log.
 *   docker compose -p trefaro-fresh logs server | grep -A 2 'no administrator'
 *
 *   # 3. Walk the wizard's API.
 *   TREFARO_BASE_URL=http://localhost:8080 \
 *   TREFARO_SETUP_TOKEN=<the token> \
 *     node tools/spike-verification/verify-setup.mjs
 *
 *   # 4. Afterwards the instance belongs to the account below, so throw it away.
 *   docker compose -p trefaro-fresh down -v
 *
 * It really does set the instance up: it creates an administrator, names the
 * organization and writes both colours. Do not point it at anything you want to
 * keep.
 */
const BASE =
  process.env.TREFARO_BASE_URL ?? process.env.BASE ?? 'http://127.0.0.1:3000';
const TOKEN = process.env.TREFARO_SETUP_TOKEN;
const SETUP_TOKEN_HEADER = 'x-trefaro-setup-token';
const SESSION_COOKIE = 'trefaro_admin_session';

const ADMIN = {
  email: process.env.TREFARO_SETUP_EMAIL ?? 'operator@example.org',
  name: 'Setup Verification',
  password: process.env.TREFARO_SETUP_PASSWORD ?? 'verify-the-setup-please',
};
const ORGANIZATION = 'Setup Verification e.V.';

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

const postJson = (path, payload, headers = {}) =>
  call(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });

const withToken = (token) => ({ [SETUP_TOKEN_HEADER]: token });

if (!TOKEN) {
  console.error(
    'TREFARO_SETUP_TOKEN must be set to the token the server printed on startup.\n' +
      "  docker compose -p <project> logs server | grep -A 2 'no administrator'",
  );
  process.exit(2);
}

// --- before ----------------------------------------------------------------

const anonymous = await call('/api/setup/state');
check(
  'the state is not readable without the token',
  anonymous.status === 401,
  `status ${anonymous.status}`,
);
check(
  'and its 401 is what says the instance is unclaimed',
  // The organizer client reads exactly this difference to decide which screen to
  // show, so it is a contract, not an implementation detail.
  anonymous.status !== 404,
);

check(
  'a wrong token is refused',
  (await call('/api/setup/state', { headers: withToken('not-the-token') }))
    .status === 401,
);

const state = await call('/api/setup/state', { headers: withToken(TOKEN) });
check(
  'the token reads the state',
  state.status === 200,
  `status ${state.status}`,
);
check(
  'the form can be filled from it',
  typeof state.body?.organizationName === 'string' &&
    Array.isArray(state.body?.locales) &&
    state.body.locales.length > 0,
  JSON.stringify(state.body?.locales),
);
check(
  'the deployment findings travel with it',
  Array.isArray(state.body?.warnings),
  `${state.body?.warnings?.length ?? '?'} finding(s)`,
);
for (const warning of state.body?.warnings ?? []) {
  console.log(`      ↳ ${warning}`);
}

check(
  'a refused value does not close the setup',
  (
    await postJson(
      '/api/setup/admin',
      {
        admin: ADMIN,
        organizationName: ORGANIZATION,
        defaultLocale: state.body?.defaultLocale ?? 'en',
        primaryColor: 'rebeccapurple',
        accentColor: '#e8a33d',
      },
      withToken(TOKEN),
    )
  ).status === 400,
);
check(
  'and the state is still readable afterwards',
  (await call('/api/setup/state', { headers: withToken(TOKEN) })).status ===
    200,
);

// --- the setup itself ------------------------------------------------------

const created = await postJson(
  '/api/setup/admin',
  {
    admin: ADMIN,
    organizationName: ORGANIZATION,
    defaultLocale: state.body?.locales?.at(-1) ?? 'en',
    primaryColor: '#1f6f5c',
    accentColor: '#e8a33d',
  },
  withToken(TOKEN),
);
check(
  'the first administrator is created',
  created.status === 201 && created.body?.adminEmail === ADMIN.email,
  `status ${created.status}`,
);

// --- after -----------------------------------------------------------------

check(
  'the setup is gone, not merely locked',
  (await call('/api/setup/state', { headers: withToken(TOKEN) })).status ===
    404,
);
check(
  'a second submission cannot create a second first administrator',
  (
    await postJson(
      '/api/setup/admin',
      {
        admin: { ...ADMIN, email: 'someone-else@example.org' },
        organizationName: 'Somebody Else',
        defaultLocale: 'en',
        primaryColor: '#000000',
        accentColor: '#ffffff',
      },
      withToken(TOKEN),
    )
  ).status === 404,
);

const config = await call('/api/config');
check(
  'the instance carries its own name and colours',
  config.body?.organizationName === ORGANIZATION &&
    config.body?.theme?.primaryColor === '#1f6f5c',
  `${config.body?.organizationName} / ${config.body?.theme?.primaryColor}`,
);
check(
  'and the language it was set to',
  config.body?.defaultLocale === (state.body?.locales?.at(-1) ?? 'en'),
  String(config.body?.defaultLocale),
);
check(
  'English is available beside it',
  (config.body?.availableLocales ?? []).includes('en'),
  JSON.stringify(config.body?.availableLocales),
);

const login = await postJson('/api/admin/auth/login', {
  email: ADMIN.email,
  password: ADMIN.password,
});
const cookie = login.headers
  .getSetCookie()
  .find((header) => header.startsWith(`${SESSION_COOKIE}=`));
check(
  'the account can sign in',
  login.status === 200,
  // Over plain HTTP against a production instance this is where E2 shows itself:
  // the response arrives, and the browser refuses to keep the `Secure` cookie.
  login.status === 200
    ? cookie?.toLowerCase().includes('secure')
      ? 'the session cookie is Secure — this instance needs HTTPS'
      : 'the session cookie is not Secure (development mode)'
    : `status ${login.status}`,
);

console.log(
  failures === 0
    ? `\nAll checks passed. This instance now belongs to ${ADMIN.email} — throw it away with \`down -v\`.`
    : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
