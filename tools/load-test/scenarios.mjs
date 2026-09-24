/**
 * What a load test asks of this application, and why each one is in the list.
 *
 * Six requests, chosen so that the numbers answer questions somebody actually
 * has rather than producing a throughput figure for a URL nobody visits:
 *
 * - **config** is what *both* clients fetch before they render anything (the
 *   start sequence of the architecture rules), so it is the endpoint with the
 *   highest hit rate of any in the instance, and the one a slow answer makes
 *   every page slow.
 * - **catalogue** is the second half of that start, and it is the largest
 *   public response the server has: over a thousand keys.
 * - **series** and **event** are the two pages reachable without a login, so
 *   they are the ones a link in a newsletter points a few hundred people at
 *   within a minute — the only realistic burst a small NGO's instance sees.
 * - **participants** is the screen the survey rated highest (3.86/4, FR 3.3)
 *   and the one the phase plan expects to fail first at volume.
 * - **search** is the same screen with a word in the box, which is the query
 *   that cannot use an index (F32) and therefore the whole question behind
 *   `pg_trgm`.
 *
 * Every one of them is a **read**. A load test that wrote would leave a
 * database full of rows nobody asked for, and the two write paths that matter
 * are rate limited by design and would be measuring the limiter (E60).
 */

/** @typedef {{ key: string, what: string, admin: boolean, path: (context: Record<string, string>) => string }} Scenario */

/** @type {readonly Scenario[]} */
export const SCENARIOS = [
  {
    key: 'config',
    what: 'the configuration both clients fetch before rendering',
    admin: false,
    path: () => '/api/config',
  },
  {
    key: 'catalogue',
    what: 'the translation catalogue, the largest public answer there is',
    admin: false,
    path: ({ locale }) => `/api/i18n/${locale}`,
  },
  {
    key: 'series',
    what: 'the public list of event series — the home page',
    admin: false,
    path: () => '/api/user/series',
  },
  {
    key: 'event',
    what: 'one public event landing page',
    admin: false,
    path: ({ seriesSlug, eventSlug }) =>
      `/api/user/series/${seriesSlug}/events/${eventSlug}`,
  },
  {
    key: 'participants',
    what: 'one page of the participant overview (FR 3.3)',
    admin: true,
    path: ({ eventId }) =>
      `/api/admin/events/${eventId}/registrations?page=1&pageSize=25`,
  },
  {
    key: 'search',
    what: 'the participant overview with a word in the search box (F32)',
    admin: true,
    path: ({ eventId, searchTerm }) =>
      `/api/admin/events/${eventId}/registrations?page=1&pageSize=25&search=${encodeURIComponent(searchTerm)}`,
  },
];
