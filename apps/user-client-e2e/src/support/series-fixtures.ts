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
  /**
   * Written, and deliberately so: the point of F50 is that a follow-up text can
   * be prepared before an event and still not be readable. The landing page
   * test asserts this sentence is nowhere on the page.
   */
  followUpBody: 'E2E this text must not be readable before the event.',
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

/**
 * Published but over: it belongs under "past events", not "upcoming".
 *
 * The only event with a follow-up text, because it is the only one allowed to
 * show one — the server withholds it until an event has ended (F50).
 */
export const PAST_EVENT = {
  slug: 'e2e-past-event',
  name: 'E2E Past Event',
  description: 'Held last quarter.',
  followUpBody:
    'E2E thank you for coming. The recording is linked below, and the next ' +
    'Democracy Day is in the spring.',
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
  {
    key: 'passport-scan',
    label: 'Passport scan',
    type: 'file',
    helpText: 'The page with your photograph, for the visa letter.',
    accept: ['application/pdf'],
    maxSizeBytes: 1024 * 1024,
    required: true,
  },
] as const;

/**
 * The programme of the upcoming event (FR 3.7).
 *
 * Placed at instants whose UTC reading differs from the venue's clock, which is
 * the whole point of the timeline assertions: the runner's zone is UTC, so a
 * page that rendered the reader's clock would show 08:00 where 09:00 or 10:00 is
 * correct (E8).
 *
 * Spread over the first and the last day of the event, so the day grouping has
 * more than one group to make.
 */
export const PROGRAM_ITEMS = [
  {
    title: 'E2E Opening keynote',
    description: 'Where direct democracy stands, and what comes next.',
    speaker: 'Dr. Amara Nwosu',
    startsAt: at(90, 8),
    endsAt: at(90, 9),
  },
  {
    title: 'E2E Workshop on citizens’ initiatives',
    description: null,
    speaker: null,
    startsAt: at(90, 12),
    endsAt: at(90, 13),
  },
  {
    title: 'E2E Closing plenary',
    description: null,
    speaker: null,
    startsAt: at(92, 8),
    endsAt: at(92, 9),
  },
  /**
   * The one session that asks who is coming (FR 3.10, AP 9).
   *
   * Deliberately without a seat limit: three browser engines run this suite
   * against one instance, each as its own participant, and a capacity of one
   * would mean the second and third engine can only fail. That a full session
   * refuses the next sign-up is proven in `apps/server-e2e`, where the seats can
   * be counted without a race.
   */
  {
    title: 'E2E Guided tour',
    description: null,
    speaker: null,
    startsAt: at(90, 14),
    endsAt: at(90, 15),
    registrationEnabled: true,
    capacity: null,
  },
] as const;

/**
 * Media links of both published events (FR 3.6, F10).
 *
 * External addresses that nobody follows in a test — `example.org` is reserved
 * for exactly this. Three shapes are needed to cover the page: a link of the
 * event as a whole, a link of one *session* (rendered inside the timeline), and
 * links on the past event, whose section sits under its follow-up text.
 *
 * `session` names the programme item a link belongs to by title, because a
 * programme item has no key of its own (F40) — the seed looks the id up.
 */
export const MEDIA_LINKS = [
  {
    event: UPCOMING_EVENT.slug,
    kind: 'stream',
    title: 'E2E Watch the plenary live',
    url: 'https://tube.example.org/w/e2e-plenary',
    session: null,
  },
  {
    event: UPCOMING_EVENT.slug,
    kind: 'material',
    title: 'E2E Slides of the opening keynote',
    url: 'https://files.example.org/e2e-keynote-slides.pdf',
    session: 'E2E Opening keynote',
  },
  {
    event: PAST_EVENT.slug,
    kind: 'recording',
    title: 'E2E Recording of the closing plenary',
    url: 'https://tube.example.org/w/e2e-closing',
    session: null,
  },
  {
    event: PAST_EVENT.slug,
    kind: 'material',
    title: 'E2E Report of the past event',
    url: 'https://files.example.org/e2e-report.pdf',
    session: null,
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

    const eventIds = await seedEvents(context, publishedSeriesId);
    const upcomingEventId = eventIds.get(UPCOMING_EVENT.slug) ?? '';
    await seedRegistrationFields(context, upcomingEventId);
    await seedProgram(context, upcomingEventId);
    await seedMediaLinks(context, eventIds);
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
): Promise<Map<string, string>> {
  const path = `/api/admin/series/${seriesId}/events`;
  const existing: AdminEvent[] = await (await context.get(path)).json();

  // Keyed by slug, because two of the three events carry fixtures of their own
  // now: the upcoming one its form and programme, the past one its media links.
  const ids = new Map<string, string>();
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
    ids.set(fixture.slug, ((await response.json()) as AdminEvent).id);
  }
  return ids;
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
            ...('accept' in fixture
              ? {
                  accept: fixture.accept,
                  maxSizeBytes: fixture.maxSizeBytes,
                }
              : {}),
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

/**
 * The programme of the upcoming event (FR 3.7).
 *
 * Matched by title, because a programme item has no key of its own — it needs
 * none, since nothing refers to it the way an answer refers to a field key
 * (F40). Removed with the event by the foreign key, so no teardown of its own.
 */
async function seedProgram(
  context: Awaited<ReturnType<typeof asAdmin>>,
  eventId: string,
): Promise<void> {
  const path = `/api/admin/events/${eventId}/program-items`;
  const existing: { id: string; title: string }[] = await (
    await context.get(path)
  ).json();

  for (const fixture of PROGRAM_ITEMS) {
    const match = existing.find((item) => item.title === fixture.title);
    const response = match
      ? await context.patch(`/api/admin/program-items/${match.id}`, {
          data: fixture,
        })
      : await context.post(path, { data: fixture });

    if (!response.ok()) {
      throw new Error(
        `Seeding the programme item "${fixture.title}" failed with status ` +
          `${response.status()}: ${await response.text()}`,
      );
    }
  }
}

/**
 * The media links of both published events (FR 3.6, F10).
 *
 * Matched by address, because a media link has no key either — and an address is
 * what makes one link the same link as another. Removed with the event by the
 * foreign key, so no teardown of its own.
 */
async function seedMediaLinks(
  context: Awaited<ReturnType<typeof asAdmin>>,
  eventIds: ReadonlyMap<string, string>,
): Promise<void> {
  for (const [slug, eventId] of eventIds) {
    const fixtures = MEDIA_LINKS.filter((link) => link.event === slug);
    if (fixtures.length === 0) continue;

    const path = `/api/admin/events/${eventId}/media-links`;
    const existing: { id: string; url: string }[] = await (
      await context.get(path)
    ).json();
    const sessions: { id: string; title: string }[] = await (
      await context.get(`/api/admin/events/${eventId}/program-items`)
    ).json();

    for (const fixture of fixtures) {
      const programItemId = fixture.session
        ? (sessions.find((item) => item.title === fixture.session)?.id ?? null)
        : null;
      if (fixture.session && !programItemId) {
        throw new Error(
          `The media link "${fixture.title}" names the session ` +
            `"${fixture.session}", which this event does not have.`,
        );
      }

      const data = {
        kind: fixture.kind,
        title: fixture.title,
        url: fixture.url,
        programItemId,
      };
      const match = existing.find((link) => link.url === fixture.url);
      const response = match
        ? await context.patch(`/api/admin/media-links/${match.id}`, { data })
        : await context.post(path, { data });

      if (!response.ok()) {
        throw new Error(
          `Seeding the media link "${fixture.title}" failed with status ` +
            `${response.status()}: ${await response.text()}`,
        );
      }
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
