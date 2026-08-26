import { execFileSync } from 'node:child_process';

const BASE = 'http://127.0.0.1:3000';
const EVENT = '11111111-1111-4111-8111-111111111111';
let failures = 0;

function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
  );
}

/** Stands in for the module administration UI, which arrives in phase 2. */
function setEnabled(moduleKey, enabled) {
  execFileSync('docker', [
    'exec',
    'trefaro-postgres',
    'psql',
    '-U',
    'trefaro',
    '-d',
    'trefaro',
    '-q',
    '-c',
    `update module_config set enabled = ${enabled} where module_key = '${moduleKey}'`,
  ]);
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

const created = await call(
  `/api/admin/plugins/room-planning/events/${EVENT}/rooms`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Room A',
      capacity: 40,
      floor: 'Ground floor',
    }),
  },
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

const duplicate = await call(
  `/api/admin/plugins/room-planning/events/${EVENT}/rooms`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '  room a  ', capacity: 10 }),
  },
);
check(
  'a duplicate room name is rejected regardless of case',
  duplicate.status === 400,
  `got ${duplicate.status}`,
);

const noSeats = await call(
  `/api/admin/plugins/room-planning/events/${EVENT}/rooms`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Broom cupboard', capacity: 0 }),
  },
);
check(
  'a room without seats is rejected',
  noSeats.status === 400,
  `got ${noSeats.status}`,
);

const listed = await call(
  `/api/admin/plugins/room-planning/events/${EVENT}/rooms`,
);
check(
  'exactly the one valid room was stored',
  Array.isArray(listed.body) && listed.body.length === 1,
  JSON.stringify(listed.body),
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

const rows = execFileSync('docker', [
  'exec',
  'trefaro-postgres',
  'psql',
  '-U',
  'trefaro',
  '-d',
  'trefaro',
  '-At',
  '-c',
  'select count(*) from plugin_room_planning_room',
])
  .toString()
  .trim();
check(
  'disabling a plug-in keeps the organization’s data',
  rows === '1',
  `${rows} row(s)`,
);

console.log(
  `\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`,
);
process.exit(failures === 0 ? 0 : 1);
