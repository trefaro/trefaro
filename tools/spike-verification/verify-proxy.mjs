/**
 * Verification against the five-container stack (infra/docker-compose.yml).
 *
 * Everything here is a claim about the reverse proxy rather than about the
 * server: the routing between the two clients and the API, and — the reason this
 * spike exists — that a socket.io upgrade survives the proxy.
 *
 * Start the stack first:
 *   docker compose --env-file .env -f infra/docker-compose.yml up -d --build
 */
import { io } from 'socket.io-client';

const BASE =
  process.env.PROXY_BASE ?? process.env.BASE ?? 'http://localhost:8080';
let failures = 0;

function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
  );
}

async function call(path, init) {
  const response = await fetch(`${BASE}${path}`, {
    redirect: 'manual',
    ...init,
  });
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: response.status, body, headers: response.headers };
}

async function waitForStack(attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`The stack at ${BASE} did not become reachable`);
}
await waitForStack();

console.log(`--- reverse proxy at ${BASE} ---`);

// --- API through the proxy ----------------------------------------------
const health = await call('/api/health');
check(
  '/api reaches the server',
  health.status === 200 && health.body?.status === 'ok',
  JSON.stringify(health.body),
);

const config = await call('/api/config');
check('/api/config is served through the proxy', config.status === 200);
check(
  'the containerised instance carries a theme of its own',
  // A hexadecimal colour, not *the* default one: since AP 5 of phase 2 the
  // first-run setup asks for both brand colours, so an instance that has been
  // set up normally does not answer with Trefaro's green — and a check that
  // insisted on it would fail on every real deployment (E17 is what makes
  // "hexadecimal" the assertion worth making).
  /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(
    config.body?.theme?.primaryColor ?? '',
  ),
  config.body?.theme?.primaryColor,
);

const bundle = await call('/api/plugins/room-planning/main.js');
check(
  'plug-in bundles are reachable under /api/plugins',
  bundle.status === 200,
);
check(
  'the bundle in the image is the built web component',
  typeof bundle.body === 'string' &&
    bundle.body.includes('trefaro-plugin-room-planning'),
);

// --- participant client at the root -------------------------------------
const root = await call('/');
check('/ serves the participant client', root.status === 200);
check(
  'the participant client is the one served at the root',
  typeof root.body === 'string' && root.body.includes('<trefaro-root>'),
);
check(
  'its base href is the root',
  typeof root.body === 'string' && root.body.includes('<base href="/"'),
);
// --- the PWA manifest, built from this instance's configuration (AP 12) --
//
// The document is served by the *server* and linked by the *client*, and only a
// running stack has both — which is why this is the only place the two halves
// meet. Everything below would have passed against a hard-coded file in the
// client image, and that file is exactly what E26 rules out.
const MANIFEST_PATH = '/api/config/manifest.webmanifest';

check(
  'the participant client links the manifest the server builds',
  typeof root.body === 'string' &&
    root.body.includes(`<link rel="manifest" href="${MANIFEST_PATH}"`),
);

const manifest = await call(MANIFEST_PATH);
check('the manifest is served through the proxy', manifest.status === 200);
check(
  'it is served as a manifest',
  (manifest.headers.get('content-type') ?? '').includes(
    'application/manifest+json',
  ),
  manifest.headers.get('content-type') ?? 'none',
);
check(
  'it installs as the organization, not as Trefaro',
  typeof manifest.body?.name === 'string' &&
    manifest.body.name === config.body?.organizationName,
  `${JSON.stringify(manifest.body?.name)} vs ${JSON.stringify(
    config.body?.organizationName,
  )}`,
);
check(
  'its splash colour is the configured primary colour',
  manifest.body?.theme_color === config.body?.theme?.primaryColor,
  `${manifest.body?.theme_color} vs ${config.body?.theme?.primaryColor}`,
);
check(
  'it starts, scopes and identifies at the root',
  manifest.body?.start_url === '/' &&
    manifest.body?.scope === '/' &&
    manifest.body?.id === '/',
);

const icons = Array.isArray(manifest.body?.icons) ? manifest.body.icons : [];
check('it declares icons at all', icons.length > 0);
check(
  'at least one icon is square, big enough and unmasked — or nothing installs',
  icons.some((icon) => {
    const [width, height] = String(icon.sizes ?? '')
      .split('x')
      .map(Number);
    return (
      String(icon.purpose ?? '')
        .split(' ')
        .includes('any') &&
      width === height &&
      width >= 144
    );
  }),
  icons.map((icon) => `${icon.sizes} ${icon.purpose}`).join(', '),
);

for (const icon of icons) {
  const image = await call(icon.src);
  check(
    `the icon at ${icon.src} is reachable through the proxy`,
    image.status === 200 &&
      (image.headers.get('content-type') ?? '').startsWith('image/'),
    `${image.status} ${image.headers.get('content-type') ?? 'no type'}`,
  );
}

const revalidated = await call(MANIFEST_PATH, {
  headers: { 'if-none-match': manifest.headers.get('etag') ?? '' },
});
check(
  'a browser that already holds the manifest gets a 304',
  revalidated.status === 304,
  `got ${revalidated.status}`,
);

const serviceWorker = await call('/ngsw-worker.js');
check(
  'the service worker is served, which push depends on',
  serviceWorker.status === 200,
);
check(
  'the service worker is not cached',
  (serviceWorker.headers.get('cache-control') ?? '').includes('no-cache'),
  serviceWorker.headers.get('cache-control') ?? 'none',
);

// The worker is served from the root, so its scope is the whole origin — the
// organizer client under /admin/ included. Angular answers every navigation
// inside the scope from its own cache unless `navigationUrls` excludes it, and
// the participant client has no route for /admin/: its wildcard route redirects
// to /. An organizer would then be unable to reach the organizer client at all,
// and only in a production build — which is why this check belongs here and
// cannot live in a unit test or in a `fetch`-based API check: neither runs a
// service worker. Found by hand after phase 1 was closed.
const swManifest = await call('/ngsw.json');
check('the service worker manifest is served', swManifest.status === 200);

/**
 * Whether the worker would answer a navigation to `url` from its own cache.
 *
 * The same rule ngsw applies: at least one positive pattern matches and no
 * negative one does. The patterns arrive as compiled regular expressions.
 */
function claimsNavigation(url) {
  const rules = swManifest.body?.navigationUrls ?? [];
  const matches = (rule) => new RegExp(rule.regex).test(url);
  return (
    rules.some((rule) => rule.positive && matches(rule)) &&
    !rules.some((rule) => !rule.positive && matches(rule))
  );
}

for (const path of [
  '/admin/',
  '/admin/series/new',
  '/api/config',
  MANIFEST_PATH,
  '/socket.io/',
]) {
  check(
    `the service worker leaves ${path} to the network`,
    !claimsNavigation(path),
    claimsNavigation(path)
      ? 'the participant client would answer it from its own cache'
      : 'left to the network',
  );
}
check(
  "the service worker does answer this client's own routes",
  claimsNavigation('/') && claimsNavigation('/series/example/events/example'),
);

const deepLink = await call('/events/11111111-1111-4111-8111-111111111111');
check(
  'a client-side route falls back to index.html rather than 404',
  deepLink.status === 200 &&
    typeof deepLink.body === 'string' &&
    deepLink.body.includes('<trefaro-root>'),
  `got ${deepLink.status}`,
);

// --- organizer client under /admin/ -------------------------------------
const adminRedirect = await call('/admin');
check(
  '/admin redirects to /admin/',
  adminRedirect.status === 301,
  `got ${adminRedirect.status} -> ${adminRedirect.headers.get('location')}`,
);

const admin = await call('/admin/');
check('/admin/ serves the organizer client', admin.status === 200);
check(
  'the organizer client was built with base href /admin/',
  typeof admin.body === 'string' && admin.body.includes('<base href="/admin/"'),
  typeof admin.body === 'string'
    ? (admin.body.match(/<base[^>]*>/) ?? ['none'])[0]
    : 'not html',
);
check(
  'the organizer client is a different build from the participant one',
  typeof admin.body === 'string' &&
    !admin.body.includes('manifest.webmanifest'),
);

// --- security headers ---------------------------------------------------
check(
  'the proxy sets X-Content-Type-Options',
  root.headers.get('x-content-type-options') === 'nosniff',
);
check(
  'the proxy sets a referrer policy',
  (root.headers.get('referrer-policy') ?? '').includes('strict-origin'),
);

// --- the actual spike: a WebSocket upgrade through the proxy ------------
console.log('--- socket.io through the proxy ---');
const socket = io(BASE, {
  transports: ['websocket'],
  reconnection: false,
  timeout: 8000,
  // The same escape hatch the rest of the run gets from
  // NODE_TLS_REJECT_UNAUTHORIZED: the websocket client keeps its own TLS
  // options, so without this a self-signed trial certificate fails the
  // handshake and reads as "the proxy does not pass upgrades".
  rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
});

const connected = await new Promise((resolve) => {
  socket.once('connect', () => resolve(true));
  socket.once('connect_error', (error) => {
    console.log(`      connect_error: ${error.message}`);
    resolve(false);
  });
  setTimeout(() => resolve(false), 9000);
});

check('the WebSocket handshake survives the reverse proxy', connected);

if (connected) {
  check(
    'it is a real upgrade, not long-polling',
    socket.io.engine.transport.name === 'websocket',
    socket.io.engine.transport.name,
  );

  const reply = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 8000);
    socket.emit('chat:echo', 'hello through nginx', (answer) => {
      clearTimeout(timer);
      resolve(answer);
    });
  });

  check(
    'frames travel both ways through the proxy',
    reply !== null,
    reply ? JSON.stringify(reply) : 'no reply within 8s',
  );
  check('the text comes back unchanged', reply?.text === 'hello through nginx');
  check(
    'the server also sees a websocket transport',
    reply?.transport === 'websocket',
    reply?.transport,
  );
}
socket.disconnect();

// --- TLS, when the overlay is running (E29) -----------------------------
//
// Everything above has already run over whatever PROXY_BASE is, so pointing that
// at the HTTPS address exercises the routing over TLS rather than duplicating it.
// What is left is what only TLS can be asked:
//
//   docker compose --env-file .env -f infra/docker-compose.yml \
//                  -f infra/docker-compose.tls.yml up -d
//   PROXY_BASE=https://localhost PROXY_PLAIN_BASE=http://localhost \
//   NODE_TLS_REJECT_UNAUTHORIZED=0 \
//     node tools/spike-verification/verify-proxy.mjs
//
// `NODE_TLS_REJECT_UNAUTHORIZED=0` belongs to a self-signed trial certificate
// only. With a real one, leave it out — otherwise the run says nothing about the
// chain, which is the part that breaks in practice: a leaf without its
// intermediates works in the browser that cached them and nowhere else.
//
// The login is the check that matters. Without TLS a production instance is
// unusable off localhost — the session cookie carries `Secure` (E2), the server
// answers correctly, and the browser discards the session. That is not a
// hardening remark, it is whether the instance can be administered at all.
if (BASE.startsWith('https://')) {
  console.log('--- TLS ---');

  const health = await call('/api/health');
  check(
    'HSTS is set, so a browser will not go back to plain HTTP',
    (health.headers.get('strict-transport-security') ?? '').includes('max-age'),
    health.headers.get('strict-transport-security') ?? 'absent',
  );

  const plain = process.env.PROXY_PLAIN_BASE;
  if (plain) {
    const response = await fetch(`${plain}/`, { redirect: 'manual' });
    check(
      'plain HTTP redirects instead of serving the application',
      response.status === 301 &&
        (response.headers.get('location') ?? '').startsWith('https://'),
      `${response.status} → ${response.headers.get('location')}`,
    );
  } else {
    console.log('SKIP  the redirect from plain HTTP — set PROXY_PLAIN_BASE');
  }

  if (
    process.env.ADMIN_BOOTSTRAP_EMAIL &&
    process.env.ADMIN_BOOTSTRAP_PASSWORD
  ) {
    // One attempt, so the login rate limit (E4) is untouched.
    const login = await call('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: process.env.ADMIN_BOOTSTRAP_EMAIL,
        password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
      }),
    });
    const cookie = login.headers
      .getSetCookie()
      .find((header) => header.startsWith('trefaro_admin_session='));

    check('an administrator can sign in over HTTPS', login.status === 200);
    check(
      'and the session cookie is Secure, which is why HTTPS was needed',
      (cookie ?? '').toLowerCase().includes('secure'),
      cookie ? cookie.split(';').slice(1).join(';').trim() : 'no cookie',
    );
  } else {
    console.log(
      'SKIP  the login over HTTPS — set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD',
    );
  }
}

console.log(
  `\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`,
);
process.exit(failures === 0 ? 0 : 1);
