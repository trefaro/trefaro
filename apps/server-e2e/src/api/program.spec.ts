import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';

/**
 * Contract of the programme (FR 3.7, FR 3.6) — AP 8.
 *
 * This suite proves the acceptance criterion of the work package: a programme
 * item outside the event's period is refused. It is asserted here rather than
 * only in a unit test because the rule spans two things a unit test fakes — the
 * event the item is measured against, and the `CHECK` in the database that
 * catches the one case the service does not need to (an item of no length).
 *
 * The three decisions it also pins down:
 *
 * - **Overlaps are accepted** (F41): parallel sessions are what a two-track
 *   conference is.
 * - **The clock is the order** (F40): no `sort`, no reorder endpoint, and the
 *   list comes back chronologically whatever order it was written in.
 * - **A draft event has no public programme**: the visibility of the programme
 *   is the visibility of its event, inherited rather than repeated.
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
  startsAt: string;
  endsAt: string;
}

interface Item {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  speaker: string | null;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

/** A one-day conference in Cologne: 08:00 to 18:00 local, 14 June 2099. */
const EVENT = {
  name: 'Programme Contract Event',
  description: 'The event whose programme this suite plans.',
  eventType: 'onsite',
  startsAt: '2099-06-14T06:00:00.000Z',
  endsAt: '2099-06-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  languages: ['de', 'en'],
  status: 'published',
} as const;

/** A session comfortably inside it: 09:00–10:30 local. */
const KEYNOTE = {
  title: 'Keynote',
  startsAt: '2099-06-14T07:00:00.000Z',
  endsAt: '2099-06-14T08:30:00.000Z',
} as const;

describe('program API', () => {
  let cookie = '';
  /** Series ids created here; deleting them takes events and items with them. */
  const created: string[] = [];
  let series: Series;
  let event: Event;
  let draftEvent: Event;

  const asAdmin = (init: RequestInit = {}): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), cookie },
  });

  const asAdminJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  const createSeries = async (
    payload: Record<string, unknown>,
  ): Promise<Series> => {
    const response = await api<Series>(
      '/api/admin/series',
      asAdminJson('POST', payload),
    );
    created.push(response.body.id);
    return response.body;
  };

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

  const plan = (payload: Record<string, unknown>, on = event.id) =>
    api<Item>(
      `/api/admin/events/${on}/program-items`,
      asAdminJson('POST', payload),
    );

  /** Plans an item and fails the test if it could not be planned. */
  const planned = async (payload: Record<string, unknown>): Promise<Item> => {
    const response = await plan(payload);
    expect(`${response.status} ${JSON.stringify(response.body)}`).toMatch(
      /^201/,
    );
    return response.body;
  };

  const programOf = (eventId: string) =>
    api<Item[]>(`/api/admin/events/${eventId}/program-items`, asAdmin());

  const publicProgram = (eventSlug: string) =>
    api<Item[]>(`/api/user/series/${series.slug}/events/${eventSlug}/program`);

  /** Empties the programme, so each test starts from a blank schedule. */
  const clearProgram = async (): Promise<void> => {
    for (const item of (await programOf(event.id)).body) {
      await api(
        `/api/admin/program-items/${item.id}`,
        asAdmin({ method: 'DELETE' }),
      );
    }
  };

  beforeAll(async () => {
    cookie = adminCookie();

    series = await createSeries({
      name: 'Programme Contract Series',
      description: 'Holds the event whose programme this suite plans.',
      status: 'published',
    });
    event = await createEvent(EVENT);
    draftEvent = await createEvent({
      ...EVENT,
      name: 'Programme Contract Draft Event',
      status: 'draft',
    });
  });

  afterAll(async () => {
    // Leave the instance as it was found — other specs read the public list.
    for (const id of created) {
      await api(`/api/admin/series/${id}`, asAdmin({ method: 'DELETE' }));
    }
  });

  afterEach(clearProgram);

  describe('the guard', () => {
    it('needs a session to read a programme', async () => {
      expect(
        (await api(`/api/admin/events/${event.id}/program-items`)).status,
      ).toBe(401);
    });

    it('needs a session to plan a session', async () => {
      const response = await api(
        `/api/admin/events/${event.id}/program-items`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(KEYNOTE),
        },
      );

      expect(response.status).toBe(401);
    });

    it('needs a session to change or remove one', async () => {
      const item = await planned(KEYNOTE);

      expect(
        (
          await api(`/api/admin/program-items/${item.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: 'Renamed by nobody' }),
          })
        ).status,
      ).toBe(401);
      expect(
        (await api(`/api/admin/program-items/${item.id}`, { method: 'DELETE' }))
          .status,
      ).toBe(401);
    });
  });

  describe('planning a session', () => {
    it('accepts one inside the event', async () => {
      const item = await planned({
        ...KEYNOTE,
        speaker: 'Dr. Amara Nwosu',
        description: 'Where direct democracy stands in 2099.',
      });

      expect(item.title).toBe('Keynote');
      expect(item.speaker).toBe('Dr. Amara Nwosu');
      expect(item.eventId).toBe(event.id);
    });

    it('refuses one that starts before the event — the acceptance criterion', async () => {
      const response = await plan({
        title: 'Breakfast beforehand',
        startsAt: '2099-06-14T05:00:00.000Z',
        endsAt: '2099-06-14T06:30:00.000Z',
      });

      expect(response.status).toBe(400);
      // The message has to name the period that was meant, in the event's own
      // zone (E8) — otherwise an organizer who typed the wrong day is guessing.
      expect(JSON.stringify(response.body)).toContain('June 14, 2099');
    });

    it('refuses one that ends after the event', async () => {
      expect(
        (
          await plan({
            title: 'Running late',
            startsAt: '2099-06-14T15:00:00.000Z',
            endsAt: '2099-06-14T17:00:00.000Z',
          })
        ).status,
      ).toBe(400);
    });

    it('refuses one on another day entirely', async () => {
      expect(
        (
          await plan({
            title: 'Day two',
            startsAt: '2099-06-15T07:00:00.000Z',
            endsAt: '2099-06-15T08:00:00.000Z',
          })
        ).status,
      ).toBe(400);
    });

    it('accepts one that fills the event exactly', async () => {
      const item = await planned({
        title: 'One long workshop',
        startsAt: EVENT.startsAt,
        endsAt: EVENT.endsAt,
      });

      expect(item.startsAt).toBe(EVENT.startsAt);
      expect(item.endsAt).toBe(EVENT.endsAt);
    });

    it('refuses one with no length at all', async () => {
      expect(
        (
          await plan({
            title: 'Nothing at all',
            startsAt: KEYNOTE.startsAt,
            endsAt: KEYNOTE.startsAt,
          })
        ).status,
      ).toBe(400);
    });

    it('refuses one that ends before it starts', async () => {
      expect(
        (
          await plan({
            title: 'Backwards',
            startsAt: KEYNOTE.endsAt,
            endsAt: KEYNOTE.startsAt,
          })
        ).status,
      ).toBe(400);
    });

    it('refuses a date that is not a date', async () => {
      expect(
        (
          await plan({
            title: 'Whenever',
            startsAt: 'next Tuesday',
            endsAt: KEYNOTE.endsAt,
          })
        ).status,
      ).toBe(400);
    });

    it('refuses a property the contract does not know', async () => {
      // The global validation pipe, same as everywhere: a typo that disappears
      // silently costs an answer nobody notices is missing. `roomId` in
      // particular — the room belongs to the plug-in (F21), not here.
      expect((await plan({ ...KEYNOTE, roomId: 'room-1' })).status).toBe(400);
    });

    it('accepts two sessions at the same time (F41)', async () => {
      await planned(KEYNOTE);
      const parallel = await plan({
        ...KEYNOTE,
        title: 'Workshop in the other room',
      });

      expect(parallel.status).toBe(201);
      expect((await programOf(event.id)).body).toHaveLength(2);
    });

    it('is a 404 for an event that does not exist', async () => {
      const response = await plan(
        KEYNOTE,
        '00000000-0000-4000-8000-000000000000',
      );

      expect(response.status).toBe(404);
    });
  });

  describe('reading a programme', () => {
    it('returns it in the order it happens, not the order it was written', async () => {
      await planned({
        title: 'Closing',
        startsAt: '2099-06-14T14:00:00.000Z',
        endsAt: '2099-06-14T15:00:00.000Z',
      });
      await planned(KEYNOTE);
      await planned({
        title: 'Lunch',
        startsAt: '2099-06-14T10:00:00.000Z',
        endsAt: '2099-06-14T11:00:00.000Z',
      });

      expect(
        (await programOf(event.id)).body.map((item) => item.title),
      ).toEqual(['Keynote', 'Lunch', 'Closing']);
    });

    it('reads the same way twice for two sessions at the same time', async () => {
      // The id is the tiebreaker (F40); without it two parallel sessions could
      // swap between two reads and the timeline would jump.
      for (let index = 0; index < 4; index += 1) {
        await planned({ ...KEYNOTE, title: `Track ${index}` });
      }

      const first = (await programOf(event.id)).body.map((item) => item.id);
      const second = (await programOf(event.id)).body.map((item) => item.id);

      expect(second).toEqual(first);
    });

    it('is a 404 for an event that does not exist, not an empty programme', async () => {
      expect(
        (
          await api(
            '/api/admin/events/00000000-0000-4000-8000-000000000000/program-items',
            asAdmin(),
          )
        ).status,
      ).toBe(404);
    });
  });

  describe('the public programme', () => {
    it('is readable without a session', async () => {
      await planned({ ...KEYNOTE, speaker: 'Dr. Amara Nwosu' });

      const response = await publicProgram(event.slug);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].speaker).toBe('Dr. Amara Nwosu');
    });

    it('says nothing an organizer knows and a participant does not', async () => {
      await planned(KEYNOTE);

      const [item] = (await publicProgram(event.slug)).body;

      expect(Object.keys(item).sort()).toEqual([
        'description',
        'endsAt',
        'id',
        'speaker',
        'startsAt',
        'title',
      ]);
    });

    it('is absent for a draft event', async () => {
      // Not forbidden — absent: the programme inherits the event's visibility,
      // and a 403 would confirm that the event exists.
      expect((await publicProgram(draftEvent.slug)).status).toBe(404);
    });

    it('is a 404 at an address no event has', async () => {
      expect((await publicProgram('no-such-event')).status).toBe(404);
    });

    it('is empty rather than missing for an event with no programme yet', async () => {
      const response = await publicProgram(event.slug);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('changing a session', () => {
    it('moves one within the event', async () => {
      const item = await planned(KEYNOTE);

      const moved = await api<Item>(
        `/api/admin/program-items/${item.id}`,
        asAdminJson('PATCH', {
          startsAt: '2099-06-14T09:00:00.000Z',
          endsAt: '2099-06-14T10:00:00.000Z',
        }),
      );

      expect(moved.status).toBe(200);
      expect(moved.body.startsAt).toBe('2099-06-14T09:00:00.000Z');
    });

    it('refuses a move that leaves the event', async () => {
      const item = await planned(KEYNOTE);

      const response = await api(
        `/api/admin/program-items/${item.id}`,
        asAdminJson('PATCH', { startsAt: '2099-06-13T07:00:00.000Z' }),
      );

      expect(response.status).toBe(400);
    });

    it('checks the merged period, not only the half that was sent', async () => {
      const item = await planned(KEYNOTE);

      const response = await api(
        `/api/admin/program-items/${item.id}`,
        asAdminJson('PATCH', { endsAt: '2099-06-14T17:00:00.000Z' }),
      );

      expect(response.status).toBe(400);
    });

    it('reads an emptied speaker as no speaker', async () => {
      const item = await planned({ ...KEYNOTE, speaker: 'Dr. Amara Nwosu' });

      const updated = await api<Item>(
        `/api/admin/program-items/${item.id}`,
        asAdminJson('PATCH', { speaker: '' }),
      );

      expect(updated.body.speaker).toBeNull();
    });

    it('keeps a session an event shift left behind, and lets it be reworded (F41)', async () => {
      const shifting = await createEvent({
        ...EVENT,
        name: 'Programme Contract Shifting Event',
      });
      const item = (
        await api<Item>(
          `/api/admin/events/${shifting.id}/program-items`,
          asAdminJson('POST', KEYNOTE),
        )
      ).body;

      // The organizer moves the conference to the following day.
      const shifted = await api(
        `/api/admin/events/${shifting.id}`,
        asAdminJson('PATCH', {
          startsAt: '2099-06-15T06:00:00.000Z',
          endsAt: '2099-06-15T16:00:00.000Z',
        }),
      );
      expect(shifted.status).toBe(200);

      // The item is still there, and still editable — refusing either would be
      // a dead end, since moving it is the only way out.
      const renamed = await api<Item>(
        `/api/admin/program-items/${item.id}`,
        asAdminJson('PATCH', { title: 'Opening words' }),
      );
      expect(renamed.status).toBe(200);
      expect(renamed.body.title).toBe('Opening words');

      // And its new time has to land inside the event's new period.
      expect(
        (
          await api(
            `/api/admin/program-items/${item.id}`,
            asAdminJson('PATCH', { startsAt: '2099-06-14T09:00:00.000Z' }),
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await api(
            `/api/admin/program-items/${item.id}`,
            asAdminJson('PATCH', {
              startsAt: '2099-06-15T07:00:00.000Z',
              endsAt: '2099-06-15T08:00:00.000Z',
            }),
          )
        ).status,
      ).toBe(200);
    });

    it('is a 404 for a session that no longer exists', async () => {
      expect(
        (
          await api(
            '/api/admin/program-items/00000000-0000-4000-8000-000000000000',
            asAdminJson('PATCH', { title: 'Anything' }),
          )
        ).status,
      ).toBe(404);
    });
  });

  describe('removing a session', () => {
    it('removes it and answers 404 the second time', async () => {
      const item = await planned(KEYNOTE);

      expect(
        (
          await api(
            `/api/admin/program-items/${item.id}`,
            asAdmin({ method: 'DELETE' }),
          )
        ).status,
      ).toBe(204);
      expect(
        (
          await api(
            `/api/admin/program-items/${item.id}`,
            asAdmin({ method: 'DELETE' }),
          )
        ).status,
      ).toBe(404);
    });

    it('goes with its event when the event is deleted', async () => {
      const doomed = await createEvent({
        ...EVENT,
        name: 'Programme Contract Doomed Event',
        status: 'draft',
      });
      const item = (
        await api<Item>(
          `/api/admin/events/${doomed.id}/program-items`,
          asAdminJson('POST', KEYNOTE),
        )
      ).body;

      const removed = await api(
        `/api/admin/events/${doomed.id}`,
        asAdmin({ method: 'DELETE' }),
      );

      expect(removed.status).toBe(204);
      expect(
        (
          await api(
            `/api/admin/program-items/${item.id}`,
            asAdminJson('PATCH', { title: 'Should be gone' }),
          )
        ).status,
      ).toBe(404);
    });
  });
});
