/**
 * Server-side verification of the Web Push spike.
 *
 * Covers everything that does not need a browser: that the instance publishes
 * only its public VAPID key, that a subscription is stored, replaced rather than
 * duplicated on re-subscribe, and removed on request.
 *
 * Actual delivery to a browser — and the iOS case, which requires the PWA to be
 * installed — has to be checked by hand. docs/spikes/ records how.
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

function countSubscriptions() {
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
    `select count(*) from push_subscription where endpoint = '${ENDPOINT}'`,
  ])
    .toString()
    .trim();
}

function storedKeys() {
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
    `select p256dh_key || '/' || auth_key from push_subscription where endpoint = '${ENDPOINT}'`,
  ])
    .toString()
    .trim();
}

const subscribe = (keys) =>
  call('/api/user/push/subscriptions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: ENDPOINT, keys }),
  });

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

console.log(
  `\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`,
);
process.exit(failures === 0 ? 0 : 1);
