const BASE = process.env.BASE ?? 'http://127.0.0.1:3000';
let failures = 0;

/** Waits for the server to accept connections before asserting anything. */
async function waitForServer(attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await fetch(`${BASE}/api/health`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`Server at ${BASE} did not become reachable`);
}
await waitForServer();

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

const json = (body) => JSON.stringify(body);

// --- health --------------------------------------------------------------
const health = await call('/api/health');
check('GET /api/health is 200', health.status === 200, json(health.body));
check('health reports the database as up', health.body?.database === 'up');
check('health status is ok', health.body?.status === 'ok');

// --- public configuration ------------------------------------------------
const config = await call('/api/config');
check(
  'GET /api/config is 200 without any authentication',
  config.status === 200,
);
/**
 * The theme comes out of the database, and it is a *configured* value.
 *
 * Until AP 13 this asserted the two seeded colours literally. That was right
 * while nothing could change them; since AP 1 of phase 2 the design page writes
 * them, so the literal turned a branded instance — the normal state of a real
 * deployment, and the state this repository's own demo seed leaves behind — into
 * a failing check that named the wrong cause. What the script can still say
 * without knowing the organization is that both colours are hexadecimal (E17,
 * the form `readableTextColor` can work with) and that a font stack arrived.
 */
const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
check(
  'config carries a theme, in the form the clients can derive from (E17)',
  hex.test(config.body?.theme?.primaryColor ?? '') &&
    hex.test(config.body?.theme?.accentColor ?? '') &&
    typeof config.body?.theme?.fontFamily === 'string' &&
    config.body.theme.fontFamily.length > 0,
  json(config.body?.theme),
);
/**
 * And if there is a logo, its URL carries no stored path (E19, F66).
 *
 * `null` is the answer on a fresh instance; anything else has to be the
 * path-free route, because the whole point of E19 is that the two kinds of
 * uploaded file are not confusable in a URL.
 */
check(
  'the logo URL is either absent or the path-free route (E19)',
  config.body?.theme?.logoUrl === null ||
    /^\/api\/media\/branding\/logo\?v=\d+$/.test(
      config.body?.theme?.logoUrl ?? '',
    ),
  json(config.body?.theme?.logoUrl),
);
/**
 * And the same promise one level down: a row logo names its row (E19, F113).
 *
 * The second pair of public routes to stored bytes, added in the logo package
 * before phase 3. Shape rather than presence: most series have no logo of their
 * own, and a demo instance has one — so what is asserted is that whatever URL
 * arrives contains the row's id and no stored path. An empty list is a pass, as
 * it is for a fresh instance with nothing published.
 */
const publicSeries = await call('/api/user/series');
const seriesLogos = Array.isArray(publicSeries.body)
  ? publicSeries.body.map((entry) => entry.logoUrl)
  : [];
check(
  'every series logo URL is absent or the path-free per-row route (E19)',
  publicSeries.status === 200 &&
    seriesLogos.every(
      (url) =>
        url === null ||
        /^\/api\/media\/series\/[0-9a-f-]{36}\/logo\?v=\d+$/.test(url ?? ''),
    ),
  json(seriesLogos),
);
check(
  'media-links and profiles are enabled by default, push is not',
  json(config.body?.enabledModules) === json(['media-links', 'profiles']),
  json(config.body?.enabledModules),
);
check(
  'a disabled plug-in is absent from the configuration',
  Array.isArray(config.body?.plugins) && config.body.plugins.length === 0,
);
/**
 * No VAPID key while the push module is off — whatever the environment holds.
 *
 * Two conditions decide this since AP 4 of phase 2 (E21): the organization's
 * flag and the deployment's key pair. A fresh instance has push switched off, so
 * this is deterministic here — it used to adapt to whether a developer's `.env`
 * carried a pair. That the key *is* published once the module is on, and that
 * subscriptions are then stored, is `verify-push.mjs`, which switches the flag.
 */
check(
  'no VAPID key is published while the push module is off',
  config.body?.webPushPublicKey === null,
  JSON.stringify(config.body?.webPushPublicKey),
);
check(
  'the private VAPID key never appears in the payload',
  !JSON.stringify(config.body).includes('PRIVATE'),
);

// --- a disabled plug-in looks absent, not forbidden ----------------------
const EVENT = '11111111-1111-4111-8111-111111111111';
const disabled = await call(
  `/api/admin/plugins/room-planning/events/${EVENT}/rooms`,
);
check(
  // 401 rather than 404, and that is the administrative guard doing its job:
  // it hangs on the `/api/admin` prefix (E16) and therefore answers before any
  // module's own guard can. That a *disabled* plug-in answers 404 to a request
  // that got past the login is what `verify-plugin-toggle.mjs` proves, with a
  // session; the same holds for a switched-off core module (F53), which
  // `apps/server-e2e/src/api/media-links.spec.ts` asserts.
  'an administrative plug-in path is 401 without a session, before anything else',
  disabled.status === 401,
  `got ${disabled.status}`,
);

// --- the plug-in bundle is served ---------------------------------------
const bundle = await call('/api/plugins/room-planning/main.js');
check('the plug-in web component bundle is served', bundle.status === 200);
check(
  'the bundle registers the element the descriptor names',
  typeof bundle.body === 'string' &&
    bundle.body.includes('trefaro-plugin-room-planning'),
);
check(
  'the bundle is not cached indefinitely',
  (bundle.headers.get('cache-control') ?? '').includes('no-cache'),
  bundle.headers.get('cache-control') ?? 'none',
);

// --- a switched-off core module looks absent ------------------------------
const pushOff = await call('/api/user/push/subscriptions', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: json({
    endpoint: 'https://push.example.org/abc',
    keys: { p256dh: 'p', auth: 'a' },
  }),
});
check(
  // 404, not 503 and not 403: a module that is off looks absent, exactly like a
  // disabled plug-in (F53). Since AP 4 of phase 2 the flag gates these endpoints
  // — before that it gated nothing, and the answer here depended on whether the
  // deployment had a VAPID pair.
  'subscribing is 404 while the push module is off',
  pushOff.status === 404,
  `got ${pushOff.status}`,
);

// --- OpenAPI -------------------------------------------------------------
const docs = await call('/api/docs-json');
check('the OpenAPI description is served', docs.status === 200);
check(
  'OpenAPI documents the public configuration endpoint',
  Boolean(docs.body?.paths?.['/api/config']),
);

console.log(
  `\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`,
);
process.exit(failures === 0 ? 0 : 1);
