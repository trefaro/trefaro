/**
 * The load test (NFR 12, AP 10 of phase 5).
 *
 * Drives a fixed number of concurrent readers at a running instance for a
 * fixed number of seconds per scenario and reports what came back: throughput,
 * the percentiles, and every status it saw. Like `spike-verification/` and
 * `demo-seed/`, it starts nothing — the instance is somebody else's, and the
 * address comes from `BASE`.
 *
 * **It has to be told it may.** Every request counts against
 * `GLOBAL_REQUESTS_PER_MINUTE`, which an instance ships at 300 — five a second.
 * A load test against that number measures the limiter, so this refuses to
 * call such a run a measurement: any 429 at all makes the report say so and
 * the process exit 3. The way to raise it is a `.env`, never a line of code
 * (E60), and `README.md` beside this file has the one to use.
 *
 * Reads only, and it neither invents load nor cleans up after itself: the six
 * scenarios are in `scenarios.mjs` with the argument for each. Filling an
 * instance with enough rows for the numbers to mean anything is a separate
 * script — `seed-registrations.mjs` — because a measurement and the thing it
 * measures should not be able to change each other.
 *
 *   BASE=http://localhost:8080 EVENT_ID=… ADMIN_EMAIL=… ADMIN_PASSWORD=… \
 *     node tools/load-test/load.mjs
 *
 * Exit codes: 0 when every scenario answered, 3 when a rate limit made the
 * numbers meaningless, 1 when the run could not happen at all.
 */
import { Agent as HttpAgent, request as httpRequest } from 'node:http';
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https';
import { SCENARIOS } from './scenarios.mjs';

const BASE = process.env.BASE ?? 'http://localhost:8080';
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? '20');
const SECONDS = Number(process.env.LOAD_SECONDS ?? '10');
const WARMUP_SECONDS = Number(process.env.LOAD_WARMUP_SECONDS ?? '2');

/**
 * What the admin scenarios need, and the values the public ones fill in.
 *
 * No defaults for the two that identify rows: a run that guessed an id would
 * measure a 404, which is fast and means nothing.
 */
const CONTEXT = {
  locale: process.env.LOAD_LOCALE ?? 'en',
  seriesSlug: process.env.SERIES_SLUG ?? '',
  eventSlug: process.env.EVENT_SLUG ?? '',
  eventId: process.env.EVENT_ID ?? '',
  searchTerm: process.env.LOAD_SEARCH ?? 'a',
};

const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? '',
  password: process.env.ADMIN_PASSWORD ?? '',
};

/** Which scenarios to run, by key; all of them by default. */
const ASKED = (process.env.LOAD_SCENARIOS ?? '')
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean);

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.ceil(fraction * sorted.length) - 1,
  );
  return Math.round(sorted[index] * 100) / 100;
}

/** Signs in once and returns the cookie header, or '' when nobody asked. */
async function signIn() {
  if (!ADMIN.email || !ADMIN.password) return '';
  const response = await fetch(`${BASE}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ADMIN),
  });
  if (!response.ok) {
    throw new Error(
      `The administrator could not sign in (${response.status}). ` +
        'ADMIN_EMAIL and ADMIN_PASSWORD have to be this instance’s.',
    );
  }
  return response.headers
    .getSetCookie()
    .map((header) => header.split(';')[0])
    .join('; ');
}

/**
 * One request, on a connection pool this file owns.
 *
 * `node:http` rather than `fetch`, and that is the one piece of this tool with
 * a scar on it. `fetch` uses one process-wide connection pool whose policy
 * nobody here chose, and it carries sockets from one scenario into the next:
 * the first two runs of this load test reported a **forty-second** worst case
 * for the fifth scenario and a hundred-millisecond one for the sixth, which is
 * the wrong way round — and running the fifth on its own gave 115 ms. The
 * number was about the driver. An agent per scenario, with as many sockets as
 * there are readers, makes the connection policy part of the measurement
 * instead of a property of whatever ran before it.
 */
function once(url, headers, agent) {
  const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve) => {
    const started = performance.now();
    const settle = (status) =>
      resolve({ status, ms: performance.now() - started });
    const request = send(url, { agent, headers }, (response) => {
      // Drained on purpose: an unread body leaves the socket busy, and the
      // next request of this reader would queue behind it.
      response.resume();
      response.on('end', () => settle(response.statusCode ?? 0));
      response.on('error', () => settle(0));
    });
    request.on('error', () => settle(0));
    request.end();
  });
}

/**
 * One scenario, driven by {@link CONCURRENCY} readers until the clock runs out.
 *
 * Every reader is a loop rather than a queue of scheduled requests: a queue
 * would keep enqueuing while the server slowed down, and the number that came
 * out would be a property of the queue. This way the instance sets the pace,
 * which is what a percentile is supposed to be about.
 */
async function drive(address, headers, seconds) {
  const url = new URL(address);
  const Agent = url.protocol === 'https:' ? HttpsAgent : HttpAgent;
  const agent = new Agent({ keepAlive: true, maxSockets: CONCURRENCY });
  const durations = [];
  const statuses = new Map();
  const deadline = Date.now() + seconds * 1000;

  async function reader() {
    while (Date.now() < deadline) {
      const { status, ms } = await once(url, headers, agent);
      durations.push(ms);
      statuses.set(status, (statuses.get(status) ?? 0) + 1);
    }
  }

  const started = performance.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, reader));
  const elapsed = (performance.now() - started) / 1000;
  // Nothing of this scenario survives into the next one.
  agent.destroy();

  durations.sort((a, b) => a - b);
  return {
    requests: durations.length,
    perSecond: Math.round((durations.length / elapsed) * 10) / 10,
    p50: percentile(durations, 0.5),
    p90: percentile(durations, 0.9),
    p95: percentile(durations, 0.95),
    p99: percentile(durations, 0.99),
    max: Math.round((durations.at(-1) ?? 0) * 100) / 100,
    // Counted rather than left to the maximum, because the maximum cannot tell
    // the two apart: a server that is slow under load makes *many* requests
    // slow, and a machine that hiccuped makes one. This measurement has seen
    // both, and only the first is about the application.
    overASecond: durations.filter((ms) => ms >= 1000).length,
    statuses: Object.fromEntries([...statuses].sort(([a], [b]) => a - b)),
  };
}

function report(scenario, url, result) {
  console.log(`\n${scenario.key} — ${scenario.what}`);
  console.log(`  ${url}`);
  console.log(
    `  ${result.requests} requests in ${SECONDS}s at ${CONCURRENCY} concurrent ` +
      `= ${result.perSecond}/s`,
  );
  console.log(
    `  p50 ${result.p50}ms   p90 ${result.p90}ms   p95 ${result.p95}ms   ` +
      `p99 ${result.p99}ms   max ${result.max}ms`,
  );
  console.log(
    `  answers: ${Object.entries(result.statuses)
      .map(([status, count]) => `${status}×${count}`)
      .join(', ')}` +
      (result.overASecond > 0
        ? `   —   ${result.overASecond} of them took longer than a second`
        : ''),
  );
}

/**
 * What the instance says about itself once the readers have stopped.
 *
 * Two numbers that ought to agree — what this driver counted and what
 * `/api/admin/operations` counted (AP 10) — plus the memory the process is
 * holding after the load, which is the figure nothing else here can produce.
 * A disagreement is worth more than either number alone: it means a request
 * was answered by something that is not counted, or counted twice.
 */
async function printOperations(cookie) {
  if (!cookie) return;
  try {
    const response = await fetch(`${BASE}/api/admin/operations`, {
      headers: { cookie },
    });
    if (!response.ok) return;
    const report = await response.json();
    console.log(
      `\nWhat the instance counted since it came up (/api/admin/operations):\n` +
        `  up ${report.uptimeSeconds}s, database ${report.database.latencyMs}ms, ` +
        `${report.memory.residentMb} MB resident\n` +
        `  answers: ${report.requests.succeeded} ok, ` +
        `${report.requests.clientErrors} client errors, ` +
        `${report.requests.throttled} throttled, ` +
        `${report.requests.serverErrors} server errors`,
    );
  } catch {
    // An instance that cannot be asked is not a failed load test.
  }
}

async function main() {
  const chosen = SCENARIOS.filter(
    (scenario) => ASKED.length === 0 || ASKED.includes(scenario.key),
  );
  if (chosen.length === 0) {
    console.error(
      `No scenario called ${ASKED.join(', ')}. Known: ${SCENARIOS.map((s) => s.key).join(', ')}.`,
    );
    return 1;
  }

  const cookie = await signIn();
  console.log(
    `Load test against ${BASE}\n` +
      `${CONCURRENCY} concurrent readers, ${SECONDS}s per scenario ` +
      `(after ${WARMUP_SECONDS}s warm-up), ${chosen.length} scenario(s)\n` +
      `Started ${new Date().toISOString()} on node ${process.version}`,
  );

  let throttled = 0;
  let skipped = 0;

  for (const scenario of chosen) {
    if (scenario.admin && !cookie) {
      console.log(
        `\n${scenario.key} — skipped: it needs a session, and ADMIN_EMAIL/` +
          'ADMIN_PASSWORD were not set.',
      );
      skipped += 1;
      continue;
    }

    let path;
    try {
      path = scenario.path(CONTEXT);
    } catch {
      path = '';
    }
    if (
      path.includes('//') ||
      path.includes('undefined') ||
      /\/\s*$/.test(path)
    ) {
      console.log(`\n${scenario.key} — skipped: it needs a value nobody gave.`);
      skipped += 1;
      continue;
    }

    const url = `${BASE}${path}`;
    const headers = scenario.admin ? { cookie } : {};

    // Warm-up is thrown away rather than reported: the first request of a
    // scenario pays for a connection, a query plan and a lazily built
    // catalogue, and none of those is what a load test is asking about.
    await drive(url, headers, WARMUP_SECONDS);
    const result = await drive(url, headers, SECONDS);
    report(scenario, url, result);
    throttled += result.statuses[429] ?? 0;
  }

  await printOperations(cookie);

  if (throttled > 0) {
    console.error(
      `\n${throttled} request(s) were refused by the rate limiter, so the ` +
        'numbers above describe the limiter and not this server. Raise ' +
        'GLOBAL_REQUESTS_PER_MINUTE in the instance’s .env, restart it, and ' +
        'run this again — then put it back (E60, see README.md).',
    );
    return 3;
  }

  console.log(
    skipped === 0
      ? '\nEvery scenario answered, and nothing was throttled.'
      : `\n${skipped} scenario(s) were skipped; the rest answered and nothing was throttled.`,
  );
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`\nThe load test could not run: ${error.message}`);
  console.error(`The instance has to be reachable at BASE (${BASE}).`);
  process.exitCode = 1;
}
