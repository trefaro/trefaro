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
check(
  'config carries the seeded theme',
  config.body?.theme?.primaryColor === '#1f6f5c' &&
    config.body?.theme?.accentColor === '#e8a33d',
  json(config.body?.theme),
);
check(
  'config reports no logo while none is uploaded',
  config.body?.theme?.logoUrl === null,
);
check(
  'only media-links is enabled by default',
  json(config.body?.enabledModules) === json(['media-links']),
  json(config.body?.enabledModules),
);
check(
  'a disabled plug-in is absent from the configuration',
  Array.isArray(config.body?.plugins) && config.body.plugins.length === 0,
);
check(
  'no VAPID key is published while push is unconfigured',
  config.body?.webPushPublicKey === null,
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
  'a disabled plug-in answers 404, not 403',
  disabled.status === 404,
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

// --- push refuses cleanly while unconfigured -----------------------------
const pushOff = await call('/api/user/push/subscriptions', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: json({
    endpoint: 'https://push.example.org/abc',
    keys: { p256dh: 'p', auth: 'a' },
  }),
});
check(
  'subscribing without a VAPID key pair is 503, not a crash',
  pushOff.status === 503,
  `got ${pushOff.status}`,
);

// --- request validation --------------------------------------------------
const extraField = await call('/api/user/push/subscriptions', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: json({
    endpoint: 'https://push.example.org/abc',
    keys: { p256dh: 'p', auth: 'a' },
    // What PushSubscription.toJSON() adds and the client has to strip.
    expirationTime: null,
  }),
});
check(
  'an unknown field is rejected rather than silently dropped',
  extraField.status === 400,
  `got ${extraField.status}`,
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
