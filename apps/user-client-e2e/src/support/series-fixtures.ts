import { request } from '@playwright/test';

/**
 * Event series the participant client's tests need to exist.
 *
 * Seeded through the administrative API rather than through SQL: the seed then
 * exercises the same rules a real organizer does, and a schema change cannot
 * leave the fixture behind. Removed again in the global teardown so a
 * developer's instance does not slowly fill with test data.
 */
export const PUBLISHED_SERIES = {
  slug: 'e2e-published-series',
  name: 'E2E Published Series',
  description: 'Visible to participants because it is published.',
  status: 'published',
} as const;

export const DRAFT_SERIES = {
  slug: 'e2e-draft-series',
  name: 'E2E Draft Series',
  description: 'Must never appear on the public start page.',
  status: 'draft',
} as const;

const FIXTURES = [PUBLISHED_SERIES, DRAFT_SERIES];

/**
 * Events of the published series, dated relative to the run.
 *
 * Relative rather than fixed: a hard-coded 2027 would quietly turn the upcoming
 * event into a past one a year from now, and the split the tests assert on
 * (FR 2.3) would start failing for a reason that has nothing to do with the code.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const at = (offsetDays: number, hour: number): string =>
  new Date(
    Date.UTC(1970, 0, 1, hour) +
      Math.trunc(Date.now() / DAY_MS + offsetDays) * DAY_MS,
  ).toISOString();

/** Hybrid, published, still to come — the acceptance criterion of AP 3. */
export const UPCOMING_EVENT = {
  slug: 'e2e-upcoming-event',
  name: 'E2E Upcoming Hybrid Event',
  description: 'On site in Cologne and online at the same time.',
  eventType: 'hybrid',
  startsAt: at(90, 8),
  endsAt: at(92, 15),
  timezone: 'Europe/Berlin',
  venueName: 'E2E Bürgerhaus Kalk',
  venueAddress: 'Kalk-Mülheimer Str. 58, 51103 Köln',
  onlineUrl: 'https://stream.example.org/e2e-upcoming',
  languages: ['de', 'en'],
  status: 'published',
} as const;

/** Published but over: it belongs under "past events", not "upcoming". */
export const PAST_EVENT = {
  slug: 'e2e-past-event',
  name: 'E2E Past Event',
  description: 'Held last quarter.',
  eventType: 'onsite',
  startsAt: at(-92, 8),
  endsAt: at(-90, 15),
  timezone: 'Europe/Berlin',
  venueName: 'E2E Alte Feuerwache',
  languages: ['de'],
  status: 'published',
} as const;

/** Must answer 404 in public, exactly like a draft series. */
export const DRAFT_EVENT = {
  slug: 'e2e-draft-event',
  name: 'E2E Draft Event',
  description: 'Still being prepared.',
  eventType: 'online',
  startsAt: at(120, 8),
  endsAt: at(120, 10),
  timezone: 'Europe/Berlin',
  languages: ['en'],
  status: 'draft',
} as const;

const EVENT_FIXTURES = [UPCOMING_EVENT, PAST_EVENT, DRAFT_EVENT];

/**
 * Extra questions on the upcoming event's registration form (F12).
 *
 * One field per type, because each renders as a different control and the
 * browser is the only place where that can be asserted. The keys are given
 * rather than derived, so the fixture stays the same across runs and can be
 * brought back into shape instead of duplicated.
 */
export const REGISTRATION_FIELDS = [
  {
    key: 'dietary-requirements',
    label: 'Dietary requirements',
    type: 'text',
    helpText: 'So the caterer knows what to plan for.',
    required: false,
  },
  {
    key: 'meal',
    label: 'Meal',
    type: 'select',
    options: ['Vegan', 'Vegetarian', 'No preference'],
    required: true,
  },
  {
    key: 'code-of-conduct',
    label: 'I have read the code of conduct',
    type: 'checkbox',
    required: true,
  },
] as const;

interface AdminSeries {
  id: string;
  slug: string;
}

interface AdminEvent {
  id: string;
  slug: string;
}

function credentials(): { email: string; password: string } {
  const email = process.env['ADMIN_BOOTSTRAP_EMAIL'] ?? '';
  const password = process.env['ADMIN_BOOTSTRAP_PASSWORD'] ?? '';
  if (!email || !password) {
    throw new Error(
      'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set so the ' +
        'participant client suite can seed the event series it asserts on. ' +
        'Add them to .env.',
    );
  }
  return { email, password };
}

/**
 * One logged-in API context, reused for every seed call.
 *
 * The login is rate limited per address and the whole suite shares one, so this
 * happens once per run.
 */
export async function asAdmin(clientUrl: string) {
  const context = await request.newContext({ baseURL: clientUrl });
  const login = await context.post('/api/admin/auth/login', {
    data: credentials(),
  });
  if (!login.ok()) {
    await context.dispose();
    throw new Error(
      `Signing in to seed the event series failed with status ${login.status()}.`,
    );
  }
  return context;
}

export async function seedSeries(clientUrl: string): Promise<void> {
  const context = await asAdmin(clientUrl);
  try {
    const existing: AdminSeries[] = await (
      await context.get('/api/admin/series')
    ).json();

    let publishedSeriesId = '';
    for (const fixture of FIXTURES) {
      const match = existing.find((series) => series.slug === fixture.slug);
      // Idempotent: a leftover from an interrupted run is brought back into
      // shape rather than duplicated under a numbered address.
      const saved: AdminSeries = match
        ? await (
            await context.patch(`/api/admin/series/${match.id}`, {
              data: fixture,
            })
          ).json()
        : await (
            await context.post('/api/admin/series', { data: fixture })
          ).json();
      if (fixture.slug === PUBLISHED_SERIES.slug) publishedSeriesId = saved.id;
    }

    await seedRegistrationFields(
      context,
      await seedEvents(context, publishedSeriesId),
    );
  } finally {
    await context.dispose();
  }
}

/**
 * The events of the published series.
 *
 * No teardown of their own: the foreign key removes them with their series,
 * which is also the behaviour the API contract suite asserts.
 */
async function seedEvents(
  context: Awaited<ReturnType<typeof asAdmin>>,
  seriesId: string,
): Promise<string> {
  const path = `/api/admin/series/${seriesId}/events`;
  const existing: AdminEvent[] = await (await context.get(path)).json();

  let upcomingEventId = '';
  for (const fixture of EVENT_FIXTURES) {
    const match = existing.find((event) => event.slug === fixture.slug);
    const response = match
      ? await context.patch(`/api/admin/events/${match.id}`, { data: fixture })
      : await context.post(path, { data: fixture });

    if (!response.ok()) {
      throw new Error(
        `Seeding the event "${fixture.slug}" failed with status ` +
          `${response.status()}: ${await response.text()}`,
      );
    }
    if (fixture.slug === UPCOMING_EVENT.slug) {
      upcomingEventId = ((await response.json()) as AdminEvent).id;
    }
  }
  return upcomingEventId;
}

/**
 * The configurable fields of the upcoming event's form (F12).
 *
 * Removed with the event by the foreign key, so they need no teardown of their
 * own — the same reason the events themselves have none.
 */
async function seedRegistrationFields(
  context: Awaited<ReturnType<typeof asAdmin>>,
  eventId: string,
): Promise<void> {
  const path = `/api/admin/events/${eventId}/registration-fields`;
  const existing: { id: string; key: string }[] = await (
    await context.get(path)
  ).json();

  for (const fixture of REGISTRATION_FIELDS) {
    const match = existing.find((field) => field.key === fixture.key);
    // A field's type and key never change, so an existing one is patched with
    // what may change and created with everything otherwise.
    const response = match
      ? await context.patch(`/api/admin/registration-fields/${match.id}`, {
          data: {
            label: fixture.label,
            helpText: 'helpText' in fixture ? fixture.helpText : null,
            required: fixture.required,
            ...('options' in fixture ? { options: fixture.options } : {}),
          },
        })
      : await context.post(path, { data: fixture });

    if (!response.ok()) {
      throw new Error(
        `Seeding the registration field "${fixture.key}" failed with status ` +
          `${response.status()}: ${await response.text()}`,
      );
    }
  }
}

export async function removeSeededSeries(clientUrl: string): Promise<void> {
  const context = await asAdmin(clientUrl);
  try {
    const existing: AdminSeries[] = await (
      await context.get('/api/admin/series')
    ).json();

    for (const fixture of FIXTURES) {
      const match = existing.find((series) => series.slug === fixture.slug);
      if (match) await context.delete(`/api/admin/series/${match.id}`);
    }
  } finally {
    await context.dispose();
  }
}
