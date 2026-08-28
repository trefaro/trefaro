/**
 * Server-side verification of the Web Push spike.
 *
 * Covers everything that does not need a browser: that the instance publishes
 * only its public VAPID key, that a subscription is stored, replaced rather than
 * duplicated on re-subscribe, and removed on request.
 *
 * Actual delivery to a browser — and the iOS case, which requires the PWA to be
 * installed — has to be checked by hand. docs/spikes/ records how.
 *
 * Since AP 4 of phase 2 `push` is a core module an organization switches on
 * (E21), and a fresh instance has it off: its endpoints answer 404 and
 * `/api/config` publishes no VAPID key. So this script switches the flag on for
 * its own duration and puts back what it found — the same shape every suite that
 * writes instance state takes. The flag is written straight into
 * `module_config`, which is what an operator does; that the administration
 * endpoint has the same effect *without* the wait is `verify-plugin-toggle.mjs`.
 */
import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3000';
const ENDPOINT = 'https://push.example.org/verification-endpoint';
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
  return { status: response.status, body };
}

function psql(sql) {
  return execFileSync('docker', [
    'exec',
    'trefaro-postgres',
    'psql',
    '-U',
    'trefaro',
    '-d',
    'trefaro',
    '-At',
    '-c',
    sql,
  ])
    .toString()
    .trim();
}

function countSubscriptions() {
  return psql(
    `select count(*) from push_subscription where endpoint = '${ENDPOINT}'`,
  );
}

function storedKeys() {
  return psql(
    `select p256dh_key || '/' || auth_key from push_subscription where endpoint = '${ENDPOINT}'`,
  );
}

/** The flag as the instance has it, so this script can put it back. */
function pushEnabled() {
  return psql(`select enabled from module_config where module_key = 'push'`);
}

function setPushEnabled(enabled) {
  psql(
    `update module_config set enabled = ${enabled} where module_key = 'push'`,
  );
}

/** The server re-reads its flags on a timer; wait rather than restart it. */
async function waitForPush(shouldAnswer, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const probe = await call('/api/user/push/subscriptions', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: ENDPOINT }),
    });
    if ((probe.status !== 404) === shouldAnswer) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

const subscribe = (keys) =>
  call('/api/user/push/subscriptions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: ENDPOINT, keys }),
  });

const wasEnabled = pushEnabled();
if (wasEnabled !== 't') {
  console.log('--- switching the push module on for this run (E21) ---');
  setPushEnabled(true);
  check(
    'the push module becomes live without restarting the server',
    await waitForPush(true),
  );
}

const config = await call('/api/config');
const publicKey = config.body?.webPushPublicKey;
check(
  'the instance publishes a VAPID public key once configured',
  typeof publicKey === 'string' && publicKey.length > 20,
  publicKey ? `${publicKey.slice(0, 12)}…` : String(publicKey),
);
check(
  'the published key is a public key, not the pair',
  JSON.stringify(config.body).length < 4000,
);

const first = await subscribe({
  p256dh: 'client-public-key',
  auth: 'client-auth',
});
check(
  'subscribing is 204 No Content',
  first.status === 204,
  `got ${first.status}`,
);
check(
  'the subscription is stored',
  countSubscriptions() === '1',
  countSubscriptions(),
);

const again = await subscribe({
  p256dh: 'rotated-public-key',
  auth: 'rotated-auth',
});
check(
  're-subscribing the same browser is accepted',
  again.status === 204,
  `got ${again.status}`,
);
check(
  're-subscribing replaces the row instead of duplicating it',
  countSubscriptions() === '1',
  countSubscriptions(),
);
check(
  'the rotated keys were written',
  storedKeys() === 'rotated-public-key/rotated-auth',
  storedKeys(),
);

const removed = await call('/api/user/push/subscriptions', {
  method: 'DELETE',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ endpoint: ENDPOINT }),
});
check(
  'unsubscribing is 204 No Content',
  removed.status === 204,
  `got ${removed.status}`,
);
check(
  'the subscription is gone',
  countSubscriptions() === '0',
  countSubscriptions(),
);

const removedAgain = await call('/api/user/push/subscriptions', {
  method: 'DELETE',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ endpoint: ENDPOINT }),
});
check(
  'unsubscribing twice is not an error',
  removedAgain.status === 204,
  `got ${removedAgain.status}`,
);

const malformed = await call('/api/user/push/subscriptions', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    endpoint: 'not-a-url',
    keys: { p256dh: 'p', auth: 'a' },
  }),
});
check(
  'a malformed endpoint is rejected',
  malformed.status === 400,
  `got ${malformed.status}`,
);

const missingKeys = await call('/api/user/push/subscriptions', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ endpoint: ENDPOINT }),
});
check(
  'a subscription without keys is rejected',
  missingKeys.status === 400,
  `got ${missingKeys.status}`,
);

const extraField = await call('/api/user/push/subscriptions', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    endpoint: ENDPOINT,
    keys: { p256dh: 'p', auth: 'a' },
    // What PushSubscription.toJSON() adds and the client has to strip. Checked
    // here rather than in `verify-api.mjs`, which meets this endpoint switched
    // off and gets a 404 whatever it sends.
    expirationTime: null,
  }),
});
check(
  'an unknown field is rejected rather than silently dropped',
  extraField.status === 400,
  `got ${extraField.status}`,
);

if (wasEnabled !== 't') {
  // The flag belongs to the instance, not to this script.
  console.log('--- switching the push module back off ---');
  setPushEnabled(false);
}

console.log(
  `\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`,
);
process.exit(failures === 0 ? 0 : 1);
