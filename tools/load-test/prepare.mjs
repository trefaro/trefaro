/**
 * The one series and the one event a load test needs, and nothing else.
 *
 * `demo-seed/` fills an instance with data worth *looking* at — five events,
 * a programme, media links, a brand. A load test wants the opposite: the
 * smallest instance in which the six scenarios of `scenarios.mjs` all address
 * something real, so that the numbers are about the server and not about how
 * much somebody seeded. So: one published series, one published event, both
 * with slugs this script chose, and the ids printed as shell assignments for
 * `measure.sh` to read.
 *
 * Idempotent: run twice and the second run finds what the first made. It
 * creates nothing else and deletes nothing.
 *
 * The HTTP client is `demo-seed`'s, imported rather than copied — it is the one
 * in this repository that already knows what a 401 and a 429 from this API mean,
 * and two of those would be two that drift apart.
 *
 *   BASE=http://localhost:8080 ADMIN_EMAIL=… ADMIN_PASSWORD=… \
 *     node tools/load-test/prepare.mjs
 */
import { Api } from '../demo-seed/api.mjs';

const BASE = process.env.BASE ?? 'http://localhost:8080';
const EMAIL = process.env.ADMIN_EMAIL ?? '';
const PASSWORD = process.env.ADMIN_PASSWORD ?? '';

const SERIES = {
  name: 'Load test series',
  slug: 'load-test-series',
  description:
    'Created by tools/load-test/prepare.mjs. Nothing here is demonstration ' +
    'material; it exists so a load test has a public page to ask for.',
  status: 'published',
};

/** A day well in the future, so the event is neither over nor about to be. */
function eventPayload() {
  const start = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const day = start.toISOString().slice(0, 10);
  return {
    name: 'Load test event',
    slug: 'load-test-event',
    description: 'The event the participant overview is measured against.',
    eventType: 'onsite',
    startsAt: `${day}T09:00:00+02:00`,
    endsAt: `${day}T17:00:00+02:00`,
    timezone: 'Europe/Berlin',
    venueName: 'Nowhere in particular',
    languages: ['de', 'en'],
    status: 'published',
  };
}

async function existingSeries(api) {
  const all = await api.admin('GET', '/api/admin/series');
  return all.find((series) => series.slug === SERIES.slug) ?? null;
}

async function existingEvent(api, seriesId) {
  const all = await api.admin('GET', `/api/admin/series/${seriesId}/events`);
  return all.find((event) => event.slug === 'load-test-event') ?? null;
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD have to be set.');
    return 1;
  }

  const api = new Api(BASE);
  await api.login(EMAIL, PASSWORD);

  const series =
    (await existingSeries(api)) ??
    (await api.admin('POST', '/api/admin/series', SERIES));
  const event =
    (await existingEvent(api, series.id)) ??
    (await api.admin(
      'POST',
      `/api/admin/series/${series.id}/events`,
      eventPayload(),
    ));

  // Shell assignments rather than prose: `measure.sh` reads this with `eval`,
  // and a format a human also reads is one nobody has to parse twice.
  console.log(`SERIES_SLUG=${series.slug}`);
  console.log(`EVENT_SLUG=${event.slug}`);
  console.log(`EVENT_ID=${event.id}`);
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`The instance could not be prepared: ${error.message}`);
  process.exitCode = 1;
}
