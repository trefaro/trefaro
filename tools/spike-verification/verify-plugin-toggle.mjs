import { execFileSync } from 'node:child_process';

/**
 * Verifies the server plug-in mechanism against a *running* instance (F6, F21,
 * E12).
 *
 * Two things only a live instance can show, which is why this script exists next
 * to the automated suites:
 *
 * 1. **Runtime activation.** A plug-in is switched on by changing
 *    `module_config` — no restart, no deployment. The server re-reads the flags
 *    on a timer, so this waits rather than restarting.
 * 2. **The plug-in's own tables and their keys.** Since AP 9 the room plan owns
 *    the link between a session and a room (F21) and reads sessions through the
 *    host's versioned port (E12). Those are its whole reason to exist, and both
 *    of them cross the seam between core and plug-in.
 *
 *   node tools/spike-verification/verify-plugin-toggle.mjs
 *
 * Reads ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD from the
 * environment — the same pair the server booted with. Since AP 1 every
 * `/api/admin/**` route needs a session (E16), and since AP 9 a room needs an
 * event that exists, so this script signs in and creates one.
 */
const BASE =
  process.env.TREFARO_BASE_URL ?? process.env.BASE ?? 'http://127.0.0.1:3000';
const SESSION_COOKIE = 'trefaro_admin_session';
const EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL;
const PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD;

/** An id in the right shape that nothing will ever have. */
const NO_SUCH_EVENT = 'ffffffff-0000-4000-8000-000000000000';

let failures = 0;
let cookie = '';

function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
  );
}

/**
 * The operator's path: the flag straight in the table.
 *
 * Still the path this script uses for the runtime-activation checks, because it
 * is the one with the timer in it — the server has to notice a change nobody told
 * it about. What the module administration of AP 4 does instead is asserted in
 * its own section further down, and its point is precisely that it needs no
 * wait.
 */
function setEnabled(moduleKey, enabled) {
  psql(
    `update module_config set enabled = ${enabled} where module_key = '${moduleKey}'`,
  );
}

/**
 * Which database container to reach into, and as whom.
 *
 * The development stack calls it `trefaro-postgres`; the production stack names
 * it after its Compose project, so a run against `-p trefaro` finds
 * `trefaro-postgres-1` and a run against a second project finds neither. Until
 * AP 13 the name was a literal, and a run against the container stack quietly
 * flipped the *development* instance's flag while asserting against the stack's
 * — every check failed, and none of them for the reason it named.
 */
const POSTGRES_CONTAINER = process.env.POSTGRES_CONTAINER ?? 'trefaro-postgres';
const DATABASE_USER = process.env.DATABASE_USER ?? 'trefaro';
const DATABASE_NAME = process.env.DATABASE_NAME ?? 'trefaro';

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
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(cookie ? { cookie } : {}) },
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

const send = (method, path, payload) =>
  call(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

/** The server re-reads the flags on a timer; wait for it rather than restarting. */
async function waitForPluginVisibility(shouldBeVisible, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const config = await call('/api/config');
    const visible = (config.body?.plugins ?? []).some(
      (p) => p.key === 'room-planning',
    );
    if (visible === shouldBeVisible) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

if (!EMAIL || !PASSWORD) {
  console.error(
    'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set — the same ' +
      'values the server booted with, so this script can sign in.',
  );
  process.exit(1);
}

console.log('--- signing in ---');
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

console.log('--- a series and an event to plan rooms for ---');
const stamp = Date.now();
const series = await send('POST', '/api/admin/series', {
  name: `Room Planning Spike ${stamp}`,
  description: 'Created by verify-plugin-toggle.mjs.',
  status: 'published',
});
check('the series is created', series.status === 201, `got ${series.status}`);
const seriesId = series.body?.id;

const eventPayload = {
  description: 'The event whose rooms this script plans.',
  eventType: 'onsite',
  startsAt: '2099-06-14T06:00:00.000Z',
  endsAt: '2099-06-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de'],
  status: 'published',
};
const event = await send('POST', `/api/admin/series/${seriesId}/events`, {
  ...eventPayload,
  name: `Room Planning Spike Event ${stamp}`,
});
check('the event is created', event.status === 201, `got ${event.status}`);
const EVENT = event.body?.id;

const otherEvent = await send('POST', `/api/admin/series/${seriesId}/events`, {
  ...eventPayload,
  name: `Room Planning Spike Other Event ${stamp}`,
});
const OTHER_EVENT = otherEvent.body?.id;

const session = await send('POST', `/api/admin/events/${EVENT}/program-items`, {
  title: 'Spike session',
  startsAt: '2099-06-14T07:00:00.000Z',
  endsAt: '2099-06-14T08:30:00.000Z',
  registrationEnabled: true,
  capacity: 10,
});
check(
  'a programme item is planned',
  session.status === 201,
  `got ${session.status}`,
);
const SESSION = session.body?.id;

const elsewhere = await send(
  'POST',
  `/api/admin/events/${OTHER_EVENT}/program-items`,
  {
    title: 'Session of another event',
    startsAt: '2099-06-14T07:00:00.000Z',
    endsAt: '2099-06-14T08:30:00.000Z',
  },
);
const OTHER_SESSION = elsewhere.body?.id;

console.log('--- while the plug-in is off ---');
const offBefore = await call(
  `/api/admin/plugins/room-planning/events/${EVENT}/rooms`,
);
check(
  'its API answers 404 while it is disabled',
  offBefore.status === 404,
  `got ${offBefore.status}`,
);

const started = Date.now();
console.log(
  '--- enabling room-planning in module_config, server keeps running ---',
);
setEnabled('room-planning', true);
const appeared = await waitForPluginVisibility(true);
check(
  'the plug-in becomes live without restarting the server',
  appeared,
  `after ${Math.round((Date.now() - started) / 1000)}s`,
);

const config = await call('/api/config');
const descriptor = (config.body?.plugins ?? []).find(
  (p) => p.key === 'room-planning',
);
check(
  'the configuration now announces the plug-in to the clients',
  Boolean(descriptor),
);
check(
  'the descriptor names the custom element',
  descriptor?.elementName === 'trefaro-plugin-room-planning',
  descriptor?.elementName,
);
check(
  'the descriptor points at the bundle the server serves',
  descriptor?.bundleUrl === '/api/plugins/room-planning/main.js',
  descriptor?.bundleUrl,
);
check(
  'the descriptor declares its mount point',
  JSON.stringify(descriptor?.mountPoints) === JSON.stringify(['event-detail']),
);
check(
  'enabling a plug-in does not add it to the core module list',
  !(config.body?.enabledModules ?? []).includes('room-planning'),
  JSON.stringify(config.body?.enabledModules),
);

console.log('--- the plug-in API now answers ---');
const empty = await call(
  `/api/admin/plugins/room-planning/events/${EVENT}/rooms`,
);
check(
  'listing rooms is 200 once enabled',
  empty.status === 200,
  `got ${empty.status}`,
);
check('a fresh event has no rooms', JSON.stringify(empty.body) === '[]');

const created = await send(
  'POST',
  `/api/admin/plugins/room-planning/events/${EVENT}/rooms`,
  { name: 'Room A', capacity: 40, floor: 'Ground floor' },
);
check('a room is created', created.status === 201, `got ${created.status}`);
check(
  'the room keeps its capacity, which the overbooking check will read',
  created.body?.capacity === 40,
);
check(
  'the room belongs to the event from the route',
  created.body?.eventId === EVENT,
);
const ROOM = created.body?.id;

const duplicate = await send(
  'POST',
  `/api/admin/plugins/room-planning/events/${EVENT}/rooms`,
  { name: '  room a  ', capacity: 10 },
);
check(
  'a duplicate room name is rejected regardless of case',
  duplicate.status === 400,
  `got ${duplicate.status}`,
);

const noSeats = await send(
  'POST',
  `/api/admin/plugins/room-planning/events/${EVENT}/rooms`,
  { name: 'Broom cupboard', capacity: 0 },
);
check(
  'a room without seats is rejected',
  noSeats.status === 400,
  `got ${noSeats.status}`,
);

// AP 9 (F21): `event_id` finally carries a foreign key, so this is the database
// answering rather than the plug-in hoping.
const orphan = await send(
  'POST',
  `/api/admin/plugins/room-planning/events/${NO_SUCH_EVENT}/rooms`,
  { name: 'Room in nowhere', capacity: 10 },
);
check(
  'a room for an event that does not exist is refused',
  orphan.status === 404,
  `got ${orphan.status}`,
);

console.log('--- the room a session happens in (F21) ---');
const assigned = await send(
  'PUT',
  `/api/admin/plugins/room-planning/program-items/${SESSION}/rooms/${ROOM}`,
);
check(
  'a session is put in a room',
  assigned.status === 204,
  `got ${assigned.status}`,
);

const twice = await send(
  'PUT',
  `/api/admin/plugins/room-planning/program-items/${SESSION}/rooms/${ROOM}`,
);
check(
  'assigning the same pair again changes nothing',
  twice.status === 204,
  `got ${twice.status}`,
);
check(
  'and there is exactly one row for it',
  psql(
    `select count(*) from plugin_room_planning_program_item_room where room_id = '${ROOM}'`,
  ) === '1',
);

const crossEvent = await send(
  'PUT',
  `/api/admin/plugins/room-planning/program-items/${OTHER_SESSION}/rooms/${ROOM}`,
);
check(
  'a session of another event is refused',
  crossEvent.status === 409,
  `got ${crossEvent.status}`,
);

const schedule = await call(
  `/api/admin/plugins/room-planning/rooms/${ROOM}/schedule`,
);
check(
  'the room schedule reads the session through the host port (E12)',
  schedule.body?.bookings?.length === 1 &&
    schedule.body.bookings[0].programItemId === SESSION,
  JSON.stringify(schedule.body?.bookings),
);
check(
  'and it carries the sign-up count, without touching a core table itself',
  schedule.body?.bookings?.[0]?.signupCount === 0 &&
    schedule.body.bookings[0].itemCapacity === 10,
);

console.log('--- what the cascades take ---');
await call(`/api/admin/program-items/${SESSION}`, { method: 'DELETE' });
check(
  'deleting a session takes its room assignment with it',
  psql(
    `select count(*) from plugin_room_planning_program_item_room where room_id = '${ROOM}'`,
  ) === '0',
);

console.log('--- disabling it again ---');
setEnabled('room-planning', false);
const disappeared = await waitForPluginVisibility(false);
check('the plug-in disappears from the configuration again', disappeared);

const blocked = await call(
  `/api/admin/plugins/room-planning/events/${EVENT}/rooms`,
);
check(
  'its API answers 404 again',
  blocked.status === 404,
  `got ${blocked.status}`,
);

check(
  'disabling a plug-in keeps the organization’s data',
  psql(
    `select count(*) from plugin_room_planning_room where id = '${ROOM}'`,
  ) === '1',
);

// --- the module administration (FR 1.5, AP 4 of phase 2) -----------------
//
// The same switch through the API an organizer uses. The difference this section
// exists for is the timing: the endpoint re-reads the flags as part of the
// request, so the next call already sees the change — no `waitFor…` anywhere
// below.
console.log('--- switching modules through the administration endpoint ---');
const modules = await call('/api/admin/modules');
check(
  'the administration lists every switchable module',
  modules.status === 200 && Array.isArray(modules.body),
  `got ${modules.status}`,
);
const listed = (modules.body ?? []).map((module) => module.key);
check(
  'including the plug-ins that are switched off',
  listed.includes('room-planning'),
  JSON.stringify(listed),
);
check(
  'and only modules that exist (E21)',
  !listed.includes('newsletter') && !listed.includes('chat'),
  JSON.stringify(listed),
);

const enabledNow = await send('PATCH', '/api/admin/modules/room-planning', {
  enabled: true,
});
check(
  'switching a plug-in on answers with its new state',
  enabledNow.status === 200 && enabledNow.body?.enabled === true,
  `got ${enabledNow.status} ${JSON.stringify(enabledNow.body)}`,
);
const immediately = await call('/api/config');
check(
  'the clients are told about it on the very next request, without waiting',
  (immediately.body?.plugins ?? []).some((p) => p.key === 'room-planning'),
  JSON.stringify((immediately.body?.plugins ?? []).map((p) => p.key)),
);
check(
  'and its API answers at once as well',
  (await call(`/api/admin/plugins/room-planning/events/${EVENT}/rooms`))
    .status === 200,
);

const disabledNow = await send('PATCH', '/api/admin/modules/room-planning', {
  enabled: false,
});
check(
  'switching it off is just as immediate',
  disabledNow.status === 200 &&
    !((await call('/api/config')).body?.plugins ?? []).some(
      (p) => p.key === 'room-planning',
    ),
);
check(
  'a key this image does not ship is refused rather than stored',
  (await send('PATCH', '/api/admin/modules/not-a-module', { enabled: true }))
    .status === 404,
);

console.log('--- cleaning up ---');
const removed = await call(`/api/admin/series/${seriesId}`, {
  method: 'DELETE',
});
check(
  'the series this script created is removed',
  removed.status === 204,
  `got ${removed.status}`,
);
check(
  'and the event took the plug-in’s rooms with it — the key added in AP 9',
  psql(
    `select count(*) from plugin_room_planning_room where id = '${ROOM}'`,
  ) === '0',
);

console.log(
  `\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`,
);
process.exit(failures === 0 ? 0 : 1);
