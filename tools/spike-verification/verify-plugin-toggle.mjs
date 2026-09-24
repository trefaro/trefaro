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
 * 3. **That the image really ships five of them** (AP 10 of phase 4). One
 *    plug-in is asserted in depth above; all five are then walked shallowly —
 *    off is a 404 and an absent descriptor, on is a descriptor a client can
 *    load and an API that answers — plus the prerequisite three of them
 *    declare: switching one on without `profiles` is a 409 that names the
 *    missing key, and `profiles` cannot be withdrawn under a running dependant
 *    (E47, E42).
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
async function waitForPluginVisibility(
  key,
  shouldBeVisible,
  timeoutMs = 30_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const config = await call('/api/config');
    const visible = (config.body?.plugins ?? []).some((p) => p.key === key);
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
const appeared = await waitForPluginVisibility('room-planning', true);
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
  'the descriptor declares both of its mount points',
  JSON.stringify(descriptor?.mountPoints) ===
    JSON.stringify(['event-detail', 'event-dashboard']),
  JSON.stringify(descriptor?.mountPoints),
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
check(
  "and the event's zone, so the plan draws the venue's clock (E69)",
  schedule.body?.bookings?.[0]?.timezone === 'Europe/Berlin',
  `timezone was ${JSON.stringify(schedule.body?.bookings?.[0]?.timezone)}`,
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
const disappeared = await waitForPluginVisibility('room-planning', false);
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
/**
 * What this image actually ships, core modules and plug-ins together.
 *
 * A literal, and it has to be maintained — which is the point: E21 says a
 * switch nothing reads must not be offered, and only a list somebody keeps can
 * say what "nothing reads" means. This one was written in phase 2 as
 * "`newsletter` and `chat` must be absent", when both were withdrawn
 * placeholder keys; `chat` came back as a real module in AP 6 of phase 3 and
 * the check failed for the right reason on the wrong grounds. `newsletter` is
 * the one key that never comes back (F8, F63) — FR 4.8 is an opt-in
 * administration and got `newsletter-opt-in` of its own in AP 12.
 *
 * Phase 4 adds one key per plug-in, and this list is where it has to be said:
 * `program-proposals` (AP 2), `forum` (AP 4), `qr-checkin` (AP 7) and
 * `personal-program` (AP 9). Keeping it in step with `CURATED_PLUGINS` is the
 * maintenance this literal is for — and AP 10 found it one key short, which is
 * exactly the failure it was written to produce.
 */
const SHIPPED = [
  'profiles',
  'profile-search',
  'chat',
  'media-links',
  'push',
  'newsletter-opt-in',
  'program-proposals',
  'forum',
  'room-planning',
  'qr-checkin',
  'personal-program',
];
check(
  'and only modules that exist (E21)',
  !listed.includes('newsletter') &&
    listed.every((key) => SHIPPED.includes(key)),
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

// --- every curated plug-in of this image (AP 10, phase 4) ----------------
//
// The section above proves the mechanism on one plug-in and reaches deep into
// it — rooms, assignments, cascades. This one is the other axis: **all five**,
// shallow, in the order `CURATED_PLUGINS` registers them, and only the three
// promises every plug-in makes (F6, F21, E21):
//
//   off  → its API is a 404 and `/api/config` does not mention it,
//   on   → the descriptor a client needs is there and the API answers,
//   off  → 404 again.
//
// Written in AP 10 because that is the package that has five of them. Through
// the administration endpoint rather than the table, so the run costs no
// waiting; the timer path stays asserted once, above.
const CURATED = [
  {
    key: 'program-proposals',
    element: 'trefaro-plugin-program-proposals',
    mountPoints: ['event-detail', 'event-dashboard'],
    icon: 'lightbulb',
    probe: () =>
      `/api/admin/plugins/program-proposals/events/${EVENT}/proposals`,
    off: 404,
    enabled: 200,
  },
  {
    key: 'forum',
    element: 'trefaro-plugin-forum',
    mountPoints: ['event-detail', 'event-dashboard'],
    icon: 'forum',
    probe: () => `/api/admin/plugins/forum/events/${EVENT}/posts`,
    off: 404,
    enabled: 200,
  },
  {
    key: 'room-planning',
    element: 'trefaro-plugin-room-planning',
    mountPoints: ['event-detail', 'event-dashboard'],
    icon: 'meeting_room',
    probe: () => `/api/admin/plugins/room-planning/events/${EVENT}/rooms`,
    off: 404,
    enabled: 200,
  },
  {
    key: 'qr-checkin',
    element: 'trefaro-plugin-qr-checkin',
    mountPoints: ['my-registration', 'event-dashboard'],
    icon: 'qr_code_2',
    probe: () => `/api/admin/plugins/qr-checkin/events/${EVENT}/checkins`,
    off: 404,
    enabled: 200,
  },
  {
    // The one route this plug-in has belongs to a **participant**, and this
    // script holds an organizer's session — so both answers here are 401, and
    // that is the finding rather than a gap. The session guard hangs on the
    // path prefix (E16, E57) and speaks **before** the plug-in's own guard:
    // somebody without a participant session is told to sign in whether the
    // plug-in is on or off. Which is the right way round, and worth asserting
    // as such — the two answers are **identical**, so a caller who cannot use
    // the route learns nothing about whether this organization runs this
    // plug-in. That a session gets a 404 while it is off is asserted where a
    // session exists: `plugin-personal-program.spec.ts`.
    key: 'personal-program',
    element: 'trefaro-plugin-personal-program',
    mountPoints: ['event-detail'],
    icon: 'event_note',
    probe: () =>
      `/api/participant/plugins/personal-program/events/${EVENT}/plan`,
    off: 401,
    enabled: 401,
  },
];

console.log('--- all five curated plug-ins, one promise each ---');
const announced = async () =>
  ((await call('/api/config')).body?.plugins ?? []).map((p) => p.key);

check(
  'a resting instance announces no plug-in at all (enabledByDefault: false)',
  (await announced()).length === 0,
  JSON.stringify(await announced()),
);

for (const plugin of CURATED) {
  const off = await call(plugin.probe());
  check(
    `${plugin.key}: switched off, its API answers ${plugin.off}`,
    off.status === plugin.off,
    `got ${off.status}`,
  );

  const on = await send('PATCH', `/api/admin/modules/${plugin.key}`, {
    enabled: true,
  });
  check(
    `${plugin.key}: it switches on at runtime`,
    on.status === 200 && on.body?.enabled === true,
    `got ${on.status}`,
  );

  const descriptor = ((await call('/api/config')).body?.plugins ?? []).find(
    (p) => p.key === plugin.key,
  );
  check(
    `${plugin.key}: the clients are told what to load and where to mount it`,
    descriptor?.elementName === plugin.element &&
      descriptor?.bundleUrl === `/api/plugins/${plugin.key}/main.js` &&
      JSON.stringify(descriptor?.mountPoints) ===
        JSON.stringify(plugin.mountPoints),
    JSON.stringify(descriptor),
  );
  check(
    `${plugin.key}: and the icon it names, from the closed set (E49)`,
    descriptor?.icon === plugin.icon,
    descriptor?.icon,
  );

  const live = await call(plugin.probe());
  check(
    plugin.off === plugin.enabled
      ? `${plugin.key}: switched on it answers ${plugin.enabled} as well — the same either way, so nothing leaks`
      : `${plugin.key}: its API answers ${plugin.enabled} once enabled`,
    live.status === plugin.enabled,
    `got ${live.status}, expected ${plugin.enabled}`,
  );

  await send('PATCH', `/api/admin/modules/${plugin.key}`, { enabled: false });
  const again = await call(plugin.probe());
  check(
    `${plugin.key}: switched off again, it is absent from the configuration`,
    again.status === plugin.off && !(await announced()).includes(plugin.key),
    `got ${again.status}`,
  );
}

check(
  'and no plug-in table was created for a plug-in that is off',
  psql(
    "select count(*) from information_schema.tables where table_name like 'plugin!_%' escape '!'",
  ) === '7',
  `${psql(
    "select count(*) from information_schema.tables where table_name like 'plugin!_%' escape '!'",
  )} tables — the schema belongs to the image, not to the switch`,
);

// --- a plug-in may have a prerequisite (E47, F190) -----------------------
//
// Three of the five write something down that belongs to a **person**, and a
// person needs an account, which only `profiles` makes. The rule is E42's,
// applied to plug-ins, and it is refused in both directions **before** writing
// — which is the half that is easy to get wrong, so it is asserted here on a
// live instance and not only in a unit test.
//
// The order below is the one the rule itself forces, and writing it the other
// way round is what taught it: `profiles` cannot simply be switched off, because
// two **core** modules stand on it as well (`profile-search` and `chat`, E42),
// and both are on by default. So the dependants come off first — read out of
// the module list rather than named here, so that a module that declares the
// prerequisite later is included without anybody remembering to.
console.log('--- what a plug-in needs (E47) ---');
const PREREQUISITE = 'profiles';

const moduleList = async () => (await call('/api/admin/modules')).body ?? [];
const dependants = (await moduleList()).filter((module) =>
  (module.requires ?? []).includes(PREREQUISITE),
);
check(
  'the module list says which modules need which',
  dependants.length > 0,
  `${dependants.length} declare "${PREREQUISITE}"`,
);
const pluginsThatNeedIt = dependants
  .filter((module) => module.family === 'plugin')
  .map((module) => module.key);
check(
  'and three of the five plug-ins are among them',
  pluginsThatNeedIt.length === 3,
  JSON.stringify(pluginsThatNeedIt),
);

const wereEnabled = dependants
  .filter((module) => module.enabled)
  .map((module) => module.key);
const heldBack = await send('PATCH', `/api/admin/modules/${PREREQUISITE}`, {
  enabled: false,
});
check(
  'it cannot be withdrawn under the modules that are running on it',
  heldBack.status === 409 &&
    String(heldBack.body?.code).startsWith('problem.config.moduleDependants') &&
    wereEnabled.every((key) =>
      String(heldBack.body?.params?.others).includes(key),
    ),
  `got ${heldBack.status} ${JSON.stringify(heldBack.body)}`,
);
check(
  'and it is still on, because the refusal came before the write',
  psql(
    `select enabled from module_config where module_key = '${PREREQUISITE}'`,
  ) === 't',
);

for (const key of wereEnabled)
  await send('PATCH', `/api/admin/modules/${key}`, { enabled: false });
const withdrawn = await send('PATCH', `/api/admin/modules/${PREREQUISITE}`, {
  enabled: false,
});
check(
  'with nothing standing on it, it switches off',
  withdrawn.status === 200,
  `got ${withdrawn.status}`,
);

for (const key of pluginsThatNeedIt) {
  const refused = await send('PATCH', `/api/admin/modules/${key}`, {
    enabled: true,
  });
  check(
    `${key}: switching it on without ${PREREQUISITE} is a 409 naming the missing key`,
    refused.status === 409 &&
      refused.body?.code === 'problem.config.moduleRequires.one' &&
      String(refused.body?.params?.others).includes(PREREQUISITE),
    `got ${refused.status} ${JSON.stringify(refused.body)}`,
  );
  check(
    `${key}: and the refusal wrote nothing`,
    psql(`select enabled from module_config where module_key = '${key}'`) !==
      't',
  );
  check(
    `${key}: nor did it appear in the configuration`,
    !((await call('/api/config')).body?.plugins ?? []).some(
      (p) => p.key === key,
    ),
  );
}

// Back to how the instance was found: the prerequisite first, then everything
// that was standing on it.
await send('PATCH', `/api/admin/modules/${PREREQUISITE}`, { enabled: true });
for (const key of wereEnabled)
  await send('PATCH', `/api/admin/modules/${key}`, { enabled: true });
const restored = await moduleList();
check(
  'and this section leaves the instance as it found it',
  wereEnabled.every(
    (key) => restored.find((module) => module.key === key)?.enabled,
  ) && restored.find((module) => module.key === PREREQUISITE)?.enabled,
  JSON.stringify(
    restored.filter((module) => module.enabled).map((module) => module.key),
  ),
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
