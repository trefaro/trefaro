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

const BASE = process.env.PROXY_BASE ?? 'http://localhost:8080';
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
  'the containerised instance seeded its own theme',
  config.body?.theme?.primaryColor === '#1f6f5c',
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
check(
  'the PWA manifest is linked',
  typeof root.body === 'string' && root.body.includes('manifest.webmanifest'),
);

const manifest = await call('/manifest.webmanifest');
check('the manifest itself is served', manifest.status === 200);
check(
  'the manifest is installable as Trefaro',
  manifest.body?.name === 'Trefaro',
  JSON.stringify(manifest.body?.name),
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

console.log(
  `\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`,
);
process.exit(failures === 0 ? 0 : 1);
