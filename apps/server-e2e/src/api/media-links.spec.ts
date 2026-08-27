import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';
import { closeDatabase, setModuleEnabled } from '../support/database';

/**
 * Contract of the media links and the follow-up text (FR 3.6, F10) — AP 11.
 *
 * The work package has two acceptance criteria and this suite is where both are
 * decided:
 *
 * 1. **A switched-off `media-links` module answers 404.** Not "disappears from
 *    `/api/config`" — that was already true before AP 11 while the endpoints kept
 *    answering (F53). The test flips the flag in `module_config`, which is the
 *    only switch that exists until phase 2, waits for the server to re-read it
 *    and then asks all three endpoints.
 * 2. **The follow-up text appears only after `ends_at`.** Asserted on the
 *    payload rather than in a browser, because that is where the decision is:
 *    withholding it in the server means a page cannot leak it (F50).
 *
 * The rest is the ordinary contract of the links themselves, plus the two rules
 * that are worth a test each: only addresses a click may follow, and a session
 * has to belong to the same event — the second one enforced by a composite
 * foreign key as well, so the 400 here is what keeps it from being a 500.
 *
 * Logs in once; see `admin-access.spec.ts` for why that matters.
 */
interface Series {
  id: string;
  slug: string;
}

interface Event {
  id: string;
  slug: string;
  followUpBody: string | null;
}

interface Item {
  id: string;
  title: string;
}

interface Link {
  id: string;
  eventId: string;
  kind: string;
  title: string;
  url: string;
  programItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Config {
  enabledModules: string[];
}

const stamp = Date.now();

/** A one-day conference in Cologne, still to come. */
const UPCOMING = {
  name: `Media Links Contract Event ${stamp}`,
  description: 'The event whose media links this suite reads.',
  eventType: 'onsite',
  startsAt: '2099-06-14T06:00:00.000Z',
  endsAt: '2099-06-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de'],
  status: 'published',
} as const;

/** The same, but over — the only way to see a follow-up text (F50). */
const PAST = {
  ...UPCOMING,
  name: `Media Links Contract Past Event ${stamp}`,
  startsAt: '2020-06-14T06:00:00.000Z',
  endsAt: '2020-06-14T16:00:00.000Z',
} as const;

const FOLLOW_UP =
  'Thank you for coming. The recordings are linked below, and the next ' +
  'Democracy Day is on 14 June.';

describe('media links API', () => {
  let cookie = '';
  let series: Series;
  let event: Event;
  let pastEvent: Event;
  let draftEvent: Event;
  /** An event of its own, to prove a link cannot name a session of another. */
  let otherEvent: Event;
  let session: Item;
  let sessionElsewhere: Item;

  const asAdmin = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });

  const asAdminJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  const listAdmin = (eventId: string) =>
    api<Link[]>(`/api/admin/events/${eventId}/media-links`, asAdmin());

  const listPublic = (eventSlug: string) =>
    api<Link[]>(
      `/api/user/series/${series.slug}/events/${eventSlug}/media-links`,
    );

  const add = (eventId: string, payload: Record<string, unknown>) =>
    api<Link>(
      `/api/admin/events/${eventId}/media-links`,
      asAdminJson('POST', payload),
    );

  /** Removes every link of one event, so each test starts from a known list. */
  const clear = async (eventId: string): Promise<void> => {
    for (const link of (await listAdmin(eventId)).body) {
      await api(`/api/admin/media-links/${link.id}`, {
        ...asAdmin(),
        method: 'DELETE',
      });
    }
  };

  beforeAll(async () => {
    cookie = adminCookie();

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson('POST', {
          name: `Media Links Contract Series ${stamp}`,
          description: 'Holds the events whose media links this suite reads.',
          status: 'published',
        }),
      )
    ).body;

    const createEvent = async (
      payload: Record<string, unknown>,
    ): Promise<Event> => {
      const response = await api<Event>(
        `/api/admin/series/${series.id}/events`,
        asAdminJson('POST', payload),
      );
      expect(`${response.status} ${JSON.stringify(response.body)}`).toMatch(
        /^201/,
      );
      return response.body;
    };

    event = await createEvent(UPCOMING);
    pastEvent = await createEvent(PAST);
    draftEvent = await createEvent({
      ...UPCOMING,
      name: `Media Links Contract Draft ${stamp}`,
      status: 'draft',
    });
    otherEvent = await createEvent({
      ...UPCOMING,
      name: `Media Links Contract Other Event ${stamp}`,
    });

    const plan = async (
      eventId: string,
      payload: Record<string, unknown>,
    ): Promise<Item> => {
      const response = await api<Item>(
        `/api/admin/events/${eventId}/program-items`,
        asAdminJson('POST', payload),
      );
      expect(`${response.status} ${JSON.stringify(response.body)}`).toMatch(
        /^201/,
      );
      return response.body;
    };

    session = await plan(event.id, {
      title: 'Opening keynote',
      startsAt: '2099-06-14T07:00:00.000Z',
      endsAt: '2099-06-14T08:00:00.000Z',
    });
    sessionElsewhere = await plan(otherEvent.id, {
      title: 'A session of another event',
      startsAt: '2099-06-14T07:00:00.000Z',
      endsAt: '2099-06-14T08:00:00.000Z',
    });
  });

  afterAll(async () => {
    // The links go with the events, and the events with their series (E14): no
    // registration was confirmed here, so the series can be deleted outright.
    await api(`/api/admin/series/${series.id}`, {
      ...asAdmin(),
      method: 'DELETE',
    });
    await closeDatabase();
  });

  describe('adding links', () => {
    beforeEach(() => clear(event.id));

    it('stores a link that belongs to the whole event', async () => {
      const created = await add(event.id, {
        kind: 'stream',
        title: 'Watch live',
        url: 'https://tube.example.org/live',
      });

      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        eventId: event.id,
        kind: 'stream',
        title: 'Watch live',
        url: 'https://tube.example.org/live',
        programItemId: null,
      });
    });

    it('attaches a link to a session of the same event', async () => {
      const created = await add(event.id, {
        kind: 'recording',
        title: 'Recording of the keynote',
        url: 'https://tube.example.org/w/keynote',
        programItemId: session.id,
      });

      expect(created.status).toBe(201);
      expect(created.body.programItemId).toBe(session.id);
    });

    it('refuses a session that belongs to another event', async () => {
      const refused = await add(event.id, {
        kind: 'recording',
        title: 'Recording of somebody else’s session',
        url: 'https://tube.example.org/w/elsewhere',
        programItemId: sessionElsewhere.id,
      });

      // The database refuses it too, through the composite foreign key on
      // `(program_item_id, event_id)`. This 400 is what keeps that from becoming
      // a 500.
      expect(refused.status).toBe(400);
    });

    it.each([
      ['javascript:alert(1)'],
      ['data:text/html,<script></script>'],
      ['tube.example.org/live'],
    ])('refuses %s as an address', async (url) => {
      const refused = await add(event.id, {
        kind: 'stream',
        title: 'Not a web address',
        url,
      });

      expect(refused.status).toBe(400);
    });

    it('refuses a kind that is not one of the three', async () => {
      const refused = await add(event.id, {
        kind: 'podcast',
        title: 'Something else',
        url: 'https://tube.example.org/live',
      });

      expect(refused.status).toBe(400);
    });

    it('says 404 for an unknown event and 400 for something that is not an id', async () => {
      expect(
        (
          await add('11111111-1111-4111-8111-111111111111', {
            kind: 'stream',
            title: 'Watch live',
            url: 'https://tube.example.org/live',
          })
        ).status,
      ).toBe(404);
      expect((await listAdmin('not-a-uuid')).status).toBe(400);
    });
  });

  describe('reading links', () => {
    beforeAll(async () => {
      await clear(event.id);
      // Added out of the order they are shown in, so the ordering rule has
      // something to do (F52).
      await add(event.id, {
        kind: 'material',
        title: 'Slides of the keynote',
        url: 'https://files.example.org/slides.pdf',
        programItemId: session.id,
      });
      await add(event.id, {
        kind: 'material',
        title: 'Report',
        url: 'https://files.example.org/report.pdf',
      });
      await add(event.id, {
        kind: 'stream',
        title: 'Watch live',
        url: 'https://tube.example.org/live',
      });
      await add(event.id, {
        kind: 'recording',
        title: 'Recording of the keynote',
        url: 'https://tube.example.org/w/keynote',
        programItemId: session.id,
      });
    });

    it('answers by kind, and within a kind as they were added', async () => {
      const links = await listAdmin(event.id);

      expect(links.status).toBe(200);
      expect(links.body.map((link) => link.title)).toEqual([
        'Watch live',
        'Recording of the keynote',
        'Slides of the keynote',
        'Report',
      ]);
    });

    it('answers publicly with the same order and nothing an organizer owns', async () => {
      const links = await listPublic(event.slug);

      expect(links.status).toBe(200);
      expect(links.body.map((link) => link.kind)).toEqual([
        'stream',
        'recording',
        'material',
        'material',
      ]);
      // No event id and no timestamps: a participant needs the link and which
      // session it belongs to.
      expect(Object.keys(links.body[0]).sort()).toEqual([
        'id',
        'kind',
        'programItemId',
        'title',
        'url',
      ]);
    });

    it('says 404 for the links of an event that is not published', async () => {
      expect((await listPublic(draftEvent.slug)).status).toBe(404);
    });

    it('refuses an anonymous request to the organizer’s list', async () => {
      expect(
        (await api(`/api/admin/events/${event.id}/media-links`)).status,
      ).toBe(401);
    });
  });

  describe('changing and removing links', () => {
    beforeEach(() => clear(event.id));

    it('writes only what was sent', async () => {
      const created = await add(event.id, {
        kind: 'stream',
        title: 'Watch live',
        url: 'https://tube.example.org/live',
      });

      const updated = await api<Link>(
        `/api/admin/media-links/${created.body.id}`,
        asAdminJson('PATCH', { kind: 'recording' }),
      );

      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({
        kind: 'recording',
        title: 'Watch live',
        url: 'https://tube.example.org/live',
      });
    });

    it('refuses a foreign session and a broken address on update as well', async () => {
      const created = await add(event.id, {
        kind: 'stream',
        title: 'Watch live',
        url: 'https://tube.example.org/live',
      });

      expect(
        (
          await api(
            `/api/admin/media-links/${created.body.id}`,
            asAdminJson('PATCH', { programItemId: sessionElsewhere.id }),
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await api(
            `/api/admin/media-links/${created.body.id}`,
            asAdminJson('PATCH', { url: 'javascript:alert(1)' }),
          )
        ).status,
      ).toBe(400);
    });

    it('removes a link and says 404 the second time', async () => {
      const created = await add(event.id, {
        kind: 'material',
        title: 'Slides',
        url: 'https://files.example.org/slides.pdf',
      });

      const removed = await api(`/api/admin/media-links/${created.body.id}`, {
        ...asAdmin(),
        method: 'DELETE',
      });
      expect(removed.status).toBe(204);
      expect((await listAdmin(event.id)).body).toEqual([]);
      expect(
        (
          await api(`/api/admin/media-links/${created.body.id}`, {
            ...asAdmin(),
            method: 'DELETE',
          })
        ).status,
      ).toBe(404);
    });

    it('takes a session’s links with the session', async () => {
      const doomed = (
        await api<Item>(
          `/api/admin/events/${event.id}/program-items`,
          asAdminJson('POST', {
            title: 'A session that gets cancelled',
            startsAt: '2099-06-14T09:00:00.000Z',
            endsAt: '2099-06-14T10:00:00.000Z',
          }),
        )
      ).body;
      await add(event.id, {
        kind: 'recording',
        title: 'Recording of a cancelled session',
        url: 'https://tube.example.org/w/cancelled',
        programItemId: doomed.id,
      });
      await add(event.id, {
        kind: 'material',
        title: 'The event’s own report',
        url: 'https://files.example.org/report.pdf',
      });

      await api(`/api/admin/program-items/${doomed.id}`, {
        ...asAdmin(),
        method: 'DELETE',
      });

      // The cascade of the composite foreign key: a session that is not
      // happening has no recording. The event's own links stay.
      expect(
        (await listAdmin(event.id)).body.map((link) => link.title),
      ).toEqual(['The event’s own report']);
    });
  });

  describe('the follow-up text (FR 3.6, F50)', () => {
    beforeAll(async () => {
      for (const target of [event, pastEvent]) {
        const written = await api<Event>(
          `/api/admin/events/${target.id}`,
          asAdminJson('PATCH', { followUpBody: FOLLOW_UP }),
        );
        expect(written.status).toBe(200);
        // The organizer reads it back whenever it was written: they are the
        // person writing it.
        expect(written.body.followUpBody).toBe(FOLLOW_UP);
      }
    });

    const publicEvent = (eventSlug: string) =>
      api<Event>(`/api/user/series/${series.slug}/events/${eventSlug}`);

    it('is withheld from the payload while the event has not ended', async () => {
      const answered = await publicEvent(event.slug);

      expect(answered.status).toBe(200);
      // Not hidden by a page — absent. A text in the JSON is a text anybody can
      // read, weeks before it is true.
      expect(answered.body.followUpBody).toBeNull();
      expect(JSON.stringify(answered.body)).not.toContain('Thank you');
    });

    it('appears once the event is over', async () => {
      expect((await publicEvent(pastEvent.slug)).body.followUpBody).toBe(
        FOLLOW_UP,
      );
    });

    it('is cleared by an emptied field rather than stored as an empty string', async () => {
      const cleared = await api<Event>(
        `/api/admin/events/${pastEvent.id}`,
        asAdminJson('PATCH', { followUpBody: '   ' }),
      );

      expect(cleared.body.followUpBody).toBeNull();
      // Put back, so the assertion above holds whatever order the tests run in.
      await api(
        `/api/admin/events/${pastEvent.id}`,
        asAdminJson('PATCH', { followUpBody: FOLLOW_UP }),
      );
    });

    it('refuses a text longer than the field allows', async () => {
      const refused = await api(
        `/api/admin/events/${event.id}`,
        asAdminJson('PATCH', { followUpBody: 'x'.repeat(5001) }),
      );

      expect(refused.status).toBe(400);
    });
  });

  /**
   * The acceptance criterion of AP 11 (F53).
   *
   * Runs last and puts the flag back in `afterAll`, because every other test
   * here needs the module on — and because an instance a test left switched off
   * would be a confusing thing for the next suite to meet.
   */
  describe('a switched-off module', () => {
    /** The server re-reads the flags on a timer; wait rather than restart. */
    const waitForModule = async (shouldBeListed: boolean): Promise<boolean> => {
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const config = await api<Config>('/api/config');
        if (
          config.body.enabledModules.includes('media-links') === shouldBeListed
        ) {
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      return false;
    };

    beforeAll(async () => {
      await setModuleEnabled('media-links', false);
      // Switched off in a hook rather than in the first test, so the three tests
      // below do not depend on each other's order.
      expect(await waitForModule(false)).toBe(true);
    }, 60_000);

    afterAll(async () => {
      await setModuleEnabled('media-links', true);
      expect(await waitForModule(true)).toBe(true);
    }, 60_000);

    it('answers 404 on every endpoint of the module', async () => {
      // All three: a module that is off is off for the organizer and for the
      // participant, and for one link as much as for the list.
      expect((await listAdmin(event.id)).status).toBe(404);
      expect((await listPublic(event.slug)).status).toBe(404);
      expect(
        (
          await add(event.id, {
            kind: 'stream',
            title: 'Watch live',
            url: 'https://tube.example.org/live',
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await api(
            '/api/admin/media-links/11111111-1111-4111-8111-111111111111',
            asAdminJson('PATCH', { title: 'Anything' }),
          )
        ).status,
      ).toBe(404);
    });

    it('leaves the rest of the application alone', async () => {
      // Nothing else may vanish with it: the event, its programme and the
      // dashboard are core, and switching a module off deletes nothing either.
      expect(
        (await api(`/api/admin/events/${event.id}`, asAdmin())).status,
      ).toBe(200);
      expect(
        (await api(`/api/admin/events/${event.id}/program-items`, asAdmin()))
          .status,
      ).toBe(200);
      expect(
        (await api(`/api/admin/events/${event.id}/dashboard`, asAdmin()))
          .status,
      ).toBe(200);
    });

    it('has no media tile on the dashboard while it is off', async () => {
      const dashboard = await api<{ mediaLinks: unknown }>(
        `/api/admin/events/${event.id}/dashboard`,
        asAdmin(),
      );

      // `null`, not four zeros: a tile leading to endpoints that answer 404
      // would be a dead end drawn as a feature (F47, F53).
      expect(dashboard.body.mediaLinks).toBeNull();
    });
  });
});
