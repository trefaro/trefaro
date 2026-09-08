import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';
import {
  closeDatabase,
  deleteRegistrations,
  deleteSeries,
  seedProgramSignups,
  seedRegistrations,
} from '../support/database';

/**
 * Contract of the room planning plug-in (FR 3.11, FR 3.6) — AP 6 of phase 4.
 *
 * The package's acceptance criterion, decided where it can be: a room is
 * added, renamed and deleted — and the deletion takes its assignments with it,
 * not the sessions; the plan shows an overbooking **and** a double booking
 * without refusing an assignment (E50); a participant reads the plan without
 * a login (E58), in their language (E56); and the plug-in still queries no core
 * table — the sign-ups behind the overbooking are seeded into the core and
 * reach the plan only through the host's port (F45).
 *
 * Instance-wide state, which is why it lives in `apps/server-e2e` and why the
 * suite puts the flag back as it found it: `module_config` belongs to the
 * instance.
 */
interface Created {
  id: string;
}

interface Room {
  id: string;
  eventId: string;
  name: string;
  capacity: number;
  floor: string | null;
  description: string | null;
}

interface PlannedSession {
  programItemId: string;
  title: string;
  startsAt: string;
  endsAt: string;
}

interface RoomBooking extends PlannedSession {
  itemCapacity: number | null;
  signupCount: number;
  warnings: string[];
}

interface PlannedRoom {
  room: Room;
  bookings: RoomBooking[];
  warnings: string[];
}

interface RoomPlan {
  rooms: PlannedRoom[];
  sessions: PlannedSession[];
}

interface PublicRoom {
  id: string;
  name: string;
  capacity: number;
  floor: string | null;
  description: string | null;
  bookings: PlannedSession[];
}

interface ModuleSummary {
  key: string;
  enabled: boolean;
}

interface PublicConfig {
  enabledModules: string[];
  plugins: { key: string; mountPoints: string[] }[];
}

const PLUGIN = 'room-planning';
const NOWHERE = '00000000-0000-4000-8000-000000000000';
const ADMIN = `/api/admin/plugins/${PLUGIN}`;
const PUBLIC = `/api/user/plugins/${PLUGIN}`;

/** The `message` of a problem answer, or the body as it came (F77). */
function problem(body: unknown): string {
  const message = (body as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : JSON.stringify(body);
}

const stamp = Date.now();
const DAY = '2099-06-14';

describe('the room planning plug-in', () => {
  let cookie: string;
  let series: Created;
  /** The event whose rooms are planned, and a second one that must stay out. */
  let event: Created;
  let otherEvent: Created;
  /** Its sessions, by the name the tests call them. */
  let plenary: Created;
  let workshop: Created;
  let panel: Created;
  let elsewhere: Created;
  let wasEnabled = false;

  const asJson = (method: string, payload?: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  const toggle = (enabled: boolean) =>
    api<unknown>(`/api/admin/modules/${PLUGIN}`, asJson('PATCH', { enabled }));

  const rooms = (eventId = event.id) =>
    api<Room[]>(`${ADMIN}/events/${eventId}/rooms`, { headers: { cookie } });
  const addRoom = (payload: unknown, eventId = event.id) =>
    api<Room>(`${ADMIN}/events/${eventId}/rooms`, asJson('POST', payload));
  const changeRoom = (roomId: string, payload: unknown, init = asJson) =>
    api<Room>(`${ADMIN}/rooms/${roomId}`, init('PATCH', payload));
  const removeRoom = (
    roomId: string,
    headers: Record<string, string> = { cookie },
  ) => api(`${ADMIN}/rooms/${roomId}`, { method: 'DELETE', headers });
  const plan = (
    eventId = event.id,
    headers: Record<string, string> = { cookie },
  ) => api<RoomPlan>(`${ADMIN}/events/${eventId}/schedule`, { headers });
  const schedule = (roomId: string) =>
    api<PlannedRoom>(`${ADMIN}/rooms/${roomId}/schedule`, {
      headers: { cookie },
    });
  const place = (itemId: string, roomId: string) =>
    api(`${ADMIN}/program-items/${itemId}/rooms/${roomId}`, {
      method: 'PUT',
      headers: { cookie },
    });
  const unplace = (itemId: string, roomId: string) =>
    api(`${ADMIN}/program-items/${itemId}/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { cookie },
    });
  /** The participant's reading — deliberately without a cookie. */
  const publicRooms = (query = '', eventId = event.id) =>
    api<PublicRoom[]>(`${PUBLIC}/events/${eventId}/rooms${query}`);

  const byName = (planned: RoomPlan, name: string): PlannedRoom => {
    const found = planned.rooms.find((one) => one.room.name === name);
    if (!found) throw new Error(`No room "${name}" in the plan`);
    return found;
  };

  beforeAll(async () => {
    cookie = adminCookie();
    const modules = await api<ModuleSummary[]>('/api/admin/modules', {
      headers: { cookie },
    });
    wasEnabled =
      modules.body.find((module) => module.key === PLUGIN)?.enabled ?? false;
    // Off first, whatever was found: the first tests assert the off state, and
    // a browser suite killed between switching on and restoring leaves the flag
    // on. What was found is still what goes back at the end.
    expect((await toggle(false)).status).toBe(200);

    series = (
      await api<Created>(
        '/api/admin/series',
        asJson('POST', {
          name: `Room Plan Contract Series ${stamp}`,
          description: 'Holds the two events whose rooms this suite plans.',
          status: 'published',
        }),
      )
    ).body;

    const newEvent = (name: string) =>
      api<Created>(
        `/api/admin/series/${series.id}/events`,
        asJson('POST', {
          name: `${name} ${stamp}`,
          description: 'On site, with rooms.',
          eventType: 'onsite',
          startsAt: `${DAY}T06:00:00.000Z`,
          endsAt: `${DAY}T16:00:00.000Z`,
          timezone: 'Europe/Berlin',
          venueName: 'Bürgerhaus Kalk',
          languages: ['de', 'en'],
          status: 'published',
        }),
      );
    event = (await newEvent('Room Plan Contract Event')).body;
    otherEvent = (await newEvent('Room Plan Contract Other Event')).body;

    const newSession = (
      eventId: string,
      title: string,
      from: string,
      to: string,
      seats?: number,
    ) =>
      api<Created>(
        `/api/admin/events/${eventId}/program-items`,
        asJson('POST', {
          title,
          startsAt: `${DAY}T${from}:00.000Z`,
          endsAt: `${DAY}T${to}:00.000Z`,
          ...(seats === undefined
            ? {}
            : { registrationEnabled: true, capacity: seats }),
        }),
      );
    plenary = (
      await newSession(event.id, 'Opening plenary', '09:00', '10:00', 60)
    ).body;
    workshop = (await newSession(event.id, 'Door-to-door', '11:00', '12:30'))
      .body;
    panel = (await newSession(event.id, 'Panel', '11:30', '12:00')).body;
    elsewhere = (
      await newSession(otherEvent.id, 'Somewhere else', '09:00', '10:00')
    ).body;

    // The German title, written the way an organizer writes one (FR 3.12) —
    // what a participant asking in German has to get back (E56).
    const translated = await api(
      `/api/admin/program-items/${plenary.id}/translations/de`,
      asJson('PUT', { title: 'Eröffnungsplenum', description: null }),
    );
    expect(translated.status).toBe(200);

    // Three people in the plenary — into the core tables, which the plug-in
    // never reads: their number reaches the plan through the port alone (F45).
    const registrations = await seedRegistrations(
      event.id,
      ['Amina', 'Bo', 'Chen'].map((firstName) => ({
        email: `${firstName.toLowerCase()}.${stamp}@rooms.example.org`,
        firstName,
        lastName: 'Contract',
        status: 'confirmed' as const,
      })),
    );
    await seedProgramSignups(plenary.id, registrations);
  });

  afterAll(async () => {
    await toggle(wasEnabled);
    await deleteRegistrations(event.id);
    await deleteSeries(series.id);
    await closeDatabase();
  });

  describe('while the organization has it switched off', () => {
    it('answers 404 on every route, the public one included, and appears in no configuration', async () => {
      const answers = await Promise.all([
        rooms(),
        addRoom({ name: 'Room A', capacity: 10 }),
        changeRoom(NOWHERE, { name: 'Room B' }),
        removeRoom(NOWHERE),
        plan(),
        schedule(NOWHERE),
        place(NOWHERE, NOWHERE),
        unplace(NOWHERE, NOWHERE),
        publicRooms(),
      ]);

      // Absent rather than forbidden — and the participant's route no less
      // than the organizer's: a plan nobody switched on is not there.
      expect(answers.map((answer) => answer.status)).toEqual(
        Array<number>(9).fill(404),
      );
      const config = await api<PublicConfig>('/api/config');
      expect(config.body.plugins.map((plugin) => plugin.key)).not.toContain(
        PLUGIN,
      );
    });
  });

  describe('switched on', () => {
    let roomA: Room;
    let roomB: Room;

    beforeAll(async () => {
      expect((await toggle(true)).status).toBe(200);
    });

    it('announces both of its hook points to the clients', async () => {
      const config = await api<PublicConfig>('/api/config');
      const descriptor = config.body.plugins.find(
        (plugin) => plugin.key === PLUGIN,
      );

      // The editor on the organizer's dashboard, the plan on the event page —
      // one bundle, two screens (F193, F202).
      expect(descriptor?.mountPoints).toEqual([
        'event-detail',
        'event-dashboard',
      ]);
    });

    it('adds a room, and refuses no seats, a name of spaces and a name in use', async () => {
      const created = await addRoom({ name: '  Room A  ', capacity: 2 });
      expect(`${created.status} ${problem(created.body)}`).toMatch(/^201/);
      roomA = created.body;
      expect(roomA).toMatchObject({
        eventId: event.id,
        name: 'Room A',
        capacity: 2,
        floor: null,
      });

      roomB = (
        await addRoom({ name: 'Room B', capacity: 20, floor: '1st floor' })
      ).body;

      const [noSeats, spaces, taken] = await Promise.all([
        addRoom({ name: 'Broom cupboard', capacity: 0 }),
        addRoom({ name: '   ', capacity: 5 }),
        addRoom({ name: 'room a', capacity: 5 }),
      ]);
      expect([noSeats.status, spaces.status, taken.status]).toEqual([
        400, 400, 400,
      ]);
      expect(problem(taken.body)).toMatch(/already has a room named/);
    });

    it('changes a room: renamed and trimmed, seats moved, floor cleared — and refuses another room’s name', async () => {
      const renamed = await changeRoom(roomA.id, { name: '  Saal A ' });
      expect(`${renamed.status} ${problem(renamed.body)}`).toMatch(/^200/);
      // Only what was sent changed.
      expect(renamed.body).toMatchObject({ name: 'Saal A', capacity: 2 });
      roomA = renamed.body;

      const cleared = await changeRoom(roomB.id, { floor: null });
      expect(cleared.body.floor).toBeNull();
      expect(cleared.body.name).toBe('Room B');

      const [taken, nowhere] = await Promise.all([
        changeRoom(roomB.id, { name: 'saal a' }),
        changeRoom(NOWHERE, { name: 'Nowhere' }),
      ]);
      expect(taken.status).toBe(400);
      expect(nowhere.status).toBe(404);
    });

    it('places sessions and refuses none of what the plan will warn about (E50)', async () => {
      // Three people in a room with two chairs, and two sessions in one room
      // at half past eleven: both go through. Only another event's session is
      // refused — that is a rule about rooms, not about warnings.
      const [tooSmall, first, overlapping, foreign] = await Promise.all([
        place(plenary.id, roomA.id),
        place(workshop.id, roomB.id),
        place(panel.id, roomB.id),
        place(elsewhere.id, roomA.id),
      ]);

      expect([tooSmall.status, first.status, overlapping.status]).toEqual([
        204, 204, 204,
      ]);
      expect(foreign.status).toBe(409);
    });

    it('draws the whole plan with both warnings, computed when it is read (E50)', async () => {
      const answer = await plan();
      expect(answer.status).toBe(200);

      const saalA = byName(answer.body, 'Saal A');
      expect(saalA.bookings).toHaveLength(1);
      // The numbers a warning is made of: the room's seats, the session's own
      // limit, and the sign-ups — which reached the plug-in through the port
      // and nothing else (F45).
      expect(saalA.bookings[0]).toMatchObject({
        programItemId: plenary.id,
        title: 'Opening plenary',
        itemCapacity: 60,
        signupCount: 3,
        warnings: ['overbooked'],
      });
      expect(saalA.warnings).toEqual(['overbooked']);

      const roomBPlanned = byName(answer.body, 'Room B');
      expect(
        roomBPlanned.bookings.map((booking) => [
          booking.title,
          booking.warnings,
        ]),
      ).toEqual([
        ['Door-to-door', ['double-booked']],
        ['Panel', ['double-booked']],
      ]);
      expect(roomBPlanned.warnings).toEqual(['double-booked']);

      // Every session of this event, in clock order, for the editor's list —
      // and not the other event's.
      expect(
        answer.body.sessions.map((session) => session.programItemId),
      ).toEqual([plenary.id, workshop.id, panel.id]);
    });

    it('moves the warning with the seats — nothing is stored', async () => {
      const widened = await changeRoom(roomA.id, { capacity: 10 });
      expect(widened.status).toBe(200);

      expect(byName((await plan()).body, 'Saal A').warnings).toEqual([]);
      // One room's schedule says the same as the plan — it is the plan's slice.
      const one = await schedule(roomA.id);
      expect(one.body.warnings).toEqual([]);
      expect(one.body.bookings[0]).toMatchObject({
        title: 'Opening plenary',
        signupCount: 3,
      });

      expect((await changeRoom(roomA.id, { capacity: 2 })).status).toBe(200);
      expect(byName((await plan()).body, 'Saal A').warnings).toEqual([
        'overbooked',
      ]);
    });

    it('hands the plan to a participant without a login, in their language, and without a number about people (FR 3.6, E56, E58)', async () => {
      const [original, german, unknownLanguage, notALanguage, empty] =
        await Promise.all([
          publicRooms(),
          publicRooms('?locale=de'),
          publicRooms('?locale=fr'),
          publicRooms('?locale=not%20a%20tag'),
          publicRooms('', otherEvent.id),
        ]);

      expect(original.status).toBe(200);
      expect(original.body.map((room) => room.name)).toEqual([
        'Room B',
        'Saal A',
      ]);
      const saalA = original.body.find((room) => room.name === 'Saal A');
      expect(saalA).toMatchObject({
        capacity: 2,
        bookings: [
          {
            programItemId: plenary.id,
            title: 'Opening plenary',
            startsAt: `${DAY}T09:00:00.000Z`,
            endsAt: `${DAY}T10:00:00.000Z`,
          },
        ],
      });
      // Three people in two chairs is the organizer's warning, not a visitor's
      // information: neither the count nor the word is in the answer.
      expect(JSON.stringify(original.body)).not.toMatch(
        /signupCount|warnings|itemCapacity/,
      );

      // Translated where somebody translated, the original where nobody has
      // (F95) — and the three answers of `?locale=` (F94).
      expect(
        german.body
          .flatMap((room) => room.bookings)
          .map((booking) => booking.title),
      ).toEqual(['Door-to-door', 'Panel', 'Eröffnungsplenum']);
      expect(unknownLanguage.status).toBe(200);
      expect(notALanguage.status).toBe(400);
      // An event without rooms has an empty plan, not an error.
      expect(empty.body).toEqual([]);
    });

    it('deletes a room with its assignments and keeps the sessions', async () => {
      expect((await removeRoom(roomB.id)).status).toBe(204);

      const after = (await plan()).body;
      expect(after.rooms.map((one) => one.room.name)).toEqual(['Saal A']);
      // The two sessions that were in Room B are still the event's.
      expect(after.sessions.map((session) => session.programItemId)).toEqual([
        plenary.id,
        workshop.id,
        panel.id,
      ]);
      const stillThere = await api(
        `/api/admin/program-items/${workshop.id}/signups`,
        { headers: { cookie } },
      );
      expect(stillThere.status).toBe(200);

      expect((await removeRoom(roomB.id)).status).toBe(404);
    });

    it('is behind the administrative session on every organizer route, and the public one is not', async () => {
      const [read, changed, removed, open] = await Promise.all([
        plan(event.id, {}),
        changeRoom(roomA.id, { name: 'Nope' }, (method, payload) => ({
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })),
        removeRoom(roomA.id, {}),
        publicRooms(),
      ]);

      expect([read.status, changed.status, removed.status]).toEqual([
        401, 401, 401,
      ]);
      expect(open.status).toBe(200);
      // And nothing happened.
      expect((await plan()).body.rooms.map((one) => one.room.name)).toEqual([
        'Saal A',
      ]);
    });
  });

  describe('switching it off again', () => {
    it('makes every route 404 and loses no row (E14)', async () => {
      expect((await toggle(false)).status).toBe(200);

      const [organizer, participant] = await Promise.all([
        plan(),
        publicRooms(),
      ]);
      expect([organizer.status, participant.status]).toEqual([404, 404]);

      expect((await toggle(true)).status).toBe(200);
      // The room and its assignment are still there: switching a plug-in off
      // never deletes anything.
      const after = (await plan()).body;
      expect(after.rooms).toHaveLength(1);
      expect(after.rooms[0].bookings.map((booking) => booking.title)).toEqual([
        'Opening plenary',
      ]);
    });
  });
});
