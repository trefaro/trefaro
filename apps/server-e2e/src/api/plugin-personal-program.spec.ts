import { adminCookie } from '../support/admin-session';
import { api } from '../support/api-client';
import {
  closeDatabase,
  deleteProfiles,
  deleteSeries,
  seedProfile,
  seedSession,
} from '../support/database';

/**
 * Contract of the personal programme plug-in (FR 3.17) — AP 9 of phase 4.
 *
 * The acceptance criterion of the package is decided here, and most of it can
 * only be decided at this level:
 *
 * - **Putting a session in a plan creates no row in `program_item_signup`**
 *   (E55, F201). Read back off the *public* programme, where `signupCount` is
 *   what somebody deciding whether to come sees: it stays at zero however often
 *   the plan is ticked. This is the one assertion the whole plug-in exists to
 *   survive, and no unit test can make it — the two tables are different tables.
 * - **The plan reads translated, and a room plan still reads the originals**
 *   (E56). The port grew a field in this package, and the plug-in that has used
 *   it since AP 6 is the regression this suite watches for.
 * - **Both writes are idempotent and answer 204** — the rules that live in an
 *   `ON CONFLICT DO NOTHING` and in a `DELETE` that reports nothing, so a fake
 *   repository could only prove that the fake obeys them.
 * - **A plan is one person's.** Two sessions, two plans, and neither sees the
 *   other's marks.
 * - **A disabled plug-in is absent, not forbidden**: every route 404, no entry
 *   in `/api/config` — and switching it off keeps every row (E14).
 *
 * Instance-wide state, which is why it lives in `apps/server-e2e` and why the
 * suite puts back the flags it found: `module_config` belongs to the instance,
 * and this suite touches three of its rows.
 *
 * The sessions are seeded rather than logged in for, like the forum suite's:
 * the login limit is twenty per five minutes for the whole run (E4), and it is
 * never relaxed for a test.
 */
interface Created {
  id: string;
  slug: string;
}

interface PlanRow {
  programItemId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  registrationEnabled: boolean;
  capacity: number | null;
  inPlan: boolean;
}

interface PublicItem {
  id: string;
  title: string;
  registrationEnabled: boolean;
  capacity: number | null;
  signupCount: number;
}

interface RoomPlan {
  rooms: unknown[];
  sessions: { programItemId: string; title: string }[];
}

interface ModuleSummary {
  key: string;
  requires: string[];
  enabled: boolean;
}

interface PublicConfig {
  enabledModules: string[];
  plugins: { key: string; mountPoints: string[] }[];
}

const PLUGIN = 'personal-program';
const NOWHERE = '00000000-0000-4000-8000-000000000000';

/** The `message` of a problem answer, or the body as it came (F77). */
function problem(body: unknown): string {
  const message = (body as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : JSON.stringify(body);
}

const stamp = Date.now();
const DOMAIN = `@plan-${stamp}.example.org`;

describe('the personal programme plug-in', () => {
  let cookie: string;
  let wasEnabled = false;
  /** The room plan is switched on for one test; what it was goes back. */
  let roomPlanningWasEnabled = false;
  let series: Created;
  let event: Created;
  /** Three sessions: a plenary, a workshop with seats, an open one. */
  let plenary: Created;
  let workshop: Created;
  let open: Created;
  /** Two accounts, so a plan can be proved to be one person's. */
  let mine = '';
  let theirs = '';

  const asJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  const toggle = (enabled: boolean, key = PLUGIN) =>
    api<unknown>(`/api/admin/modules/${key}`, asJson('PATCH', { enabled }));

  const moduleRow = async (key: string): Promise<ModuleSummary> => {
    const list = await api<ModuleSummary[]>('/api/admin/modules', {
      headers: { cookie },
    });
    const found = list.body.find((module) => module.key === key);
    if (!found) throw new Error(`No module "${key}" in the list`);
    return found;
  };

  const asSession = (session: string) => ({
    headers: { cookie: `trefaro_user_session=${session}` },
  });

  const plan = (session = mine, query = '') =>
    api<PlanRow[]>(
      `/api/participant/plugins/${PLUGIN}/events/${event.id}/plan${query}`,
      asSession(session),
    );

  const put = (itemId: string, session = mine) =>
    api<unknown>(`/api/participant/plugins/${PLUGIN}/program-items/${itemId}`, {
      method: 'PUT',
      ...asSession(session),
    });

  const drop = (itemId: string, session = mine) =>
    api<unknown>(`/api/participant/plugins/${PLUGIN}/program-items/${itemId}`, {
      method: 'DELETE',
      ...asSession(session),
    });

  const publicProgram = (locale?: string) =>
    api<PublicItem[]>(
      `/api/user/series/${series.slug}/events/${event.slug}/program` +
        (locale ? `?locale=${locale}` : ''),
    );

  const rowFor = async (itemId: string, session = mine): Promise<PlanRow> => {
    const answer = await plan(session);
    const row = answer.body.find((one) => one.programItemId === itemId);
    if (!row) throw new Error(`No row for ${itemId}`);
    return row;
  };

  beforeAll(async () => {
    cookie = adminCookie();
    wasEnabled = (await moduleRow(PLUGIN)).enabled;
    roomPlanningWasEnabled = (await moduleRow('room-planning')).enabled;
    // Off first, whatever was found: the first tests assert the off state, and
    // a run killed between switching on and restoring leaves the flag on. What
    // was found is still what goes back at the end.
    expect((await toggle(false)).status).toBe(200);

    series = (
      await api<Created>(
        '/api/admin/series',
        asJson('POST', {
          name: `Personal Plan Contract Series ${stamp}`,
          description: 'Holds the event whose programme people tick.',
          status: 'published',
        }),
      )
    ).body;

    event = (
      await api<Created>(
        `/api/admin/series/${series.id}/events`,
        asJson('POST', {
          name: `Personal Plan Contract Event ${stamp}`,
          description: 'A day with three sessions and nobody signed up.',
          eventType: 'onsite',
          startsAt: '2099-06-14T06:00:00.000Z',
          endsAt: '2099-06-14T16:00:00.000Z',
          timezone: 'Europe/Berlin',
          venueName: 'Bürgerhaus Kalk',
          languages: ['de', 'en'],
          status: 'published',
        }),
      )
    ).body;

    const session = (payload: Record<string, unknown>) =>
      api<Created>(
        `/api/admin/events/${event.id}/program-items`,
        asJson('POST', payload),
      );

    plenary = (
      await session({
        title: 'Opening plenary',
        startsAt: '2099-06-14T07:00:00.000Z',
        endsAt: '2099-06-14T08:00:00.000Z',
      })
    ).body;
    // The one that books seats, and the reason `registrationEnabled` travels.
    workshop = (
      await session({
        title: 'Workshop: campaigning without a budget',
        startsAt: '2099-06-14T09:00:00.000Z',
        endsAt: '2099-06-14T11:00:00.000Z',
        registrationEnabled: true,
        capacity: 12,
      })
    ).body;
    open = (
      await session({
        title: 'Open space',
        startsAt: '2099-06-14T12:00:00.000Z',
        endsAt: '2099-06-14T13:00:00.000Z',
        registrationEnabled: true,
      })
    ).body;

    // One translated title, so "reads in the reader's language" has something
    // to read and something to fall back from (F95).
    expect(
      (
        await api(
          `/api/admin/program-items/${plenary.id}/translations/de`,
          asJson('PUT', { title: 'Eröffnungsplenum' }),
        )
      ).status,
    ).toBe(200);

    mine = await seedSession(
      await seedProfile({
        email: `mine${DOMAIN}`,
        firstName: 'Amina',
        lastName: 'Okonkwo',
      }),
    );
    theirs = await seedSession(
      await seedProfile({
        email: `theirs${DOMAIN}`,
        firstName: 'Jonas',
        lastName: 'Weber',
      }),
    );
  });

  afterAll(async () => {
    // Everything this suite touched, back as it was.
    await toggle(wasEnabled);
    await toggle(roomPlanningWasEnabled, 'room-planning');
    await toggle(true, 'profiles');
    await deleteSeries(series.id);
    await deleteProfiles(DOMAIN);
    await closeDatabase();
  });

  describe('while the organization has it switched off', () => {
    it('answers 404 on every route and appears in no configuration', async () => {
      const [reading, adding, removing, config] = await Promise.all([
        plan(),
        put(plenary.id),
        drop(plenary.id),
        api<PublicConfig>('/api/config'),
      ]);

      // Absent rather than forbidden, so a client sees the same thing the API
      // says: nothing here.
      expect([reading.status, adding.status, removing.status]).toEqual([
        404, 404, 404,
      ]);
      expect(config.body.plugins.map((one) => one.key)).not.toContain(PLUGIN);
      expect(config.body.enabledModules).not.toContain(PLUGIN);
    });

    it('is still listed for the organizer, with what it needs (E47)', async () => {
      const row = await moduleRow(PLUGIN);

      // The row says what to switch on first — before the click, not after it.
      expect(row).toMatchObject({ enabled: false, requires: ['profiles'] });
    });
  });

  describe('switched on', () => {
    it('holds accounts in place while it runs, and names itself (E47)', async () => {
      expect((await toggle(true)).status).toBe(200);

      const refused = await toggle(false, 'profiles');

      expect(refused.status).toBe(409);
      expect(problem(refused.body)).toContain(`"${PLUGIN}"`);
      expect((await moduleRow('profiles')).enabled).toBe(true);
    });

    it('names its one hook point in the public configuration', async () => {
      const config = await api<PublicConfig>('/api/config');
      const listed = config.body.plugins.find((one) => one.key === PLUGIN);

      // The only plug-in of the five with a single hook point: a plan is made
      // where the programme is read, and there is no organizer's half (E55).
      expect(listed?.mountPoints).toEqual(['event-detail']);
    });
  });

  describe('reading one event (FR 3.17)', () => {
    it('answers with the whole programme in clock order, nothing ticked', async () => {
      const answer = await plan();

      expect(answer.status).toBe(200);
      expect(answer.body.map((row) => row.programItemId)).toEqual([
        plenary.id,
        workshop.id,
        open.id,
      ]);
      expect(answer.body.every((row) => !row.inPlan)).toBe(true);
    });

    it('says where a seat is booked, in both shapes of FR 3.10 (F42)', async () => {
      const answer = await plan();

      expect(answer.body.map((row) => row.registrationEnabled)).toEqual([
        false,
        true,
        true,
      ]);
      // A limit, and a sign-up with no limit — which `capacity` alone could
      // not tell apart from a session that asks nothing.
      expect(answer.body.map((row) => row.capacity)).toEqual([null, 12, null]);
    });

    it('carries nothing about people', async () => {
      const answer = await plan();

      // No sign-up count, no names, no seat of anybody's: how full a session
      // is belongs to the programme, and a personal plan is not a second
      // occupancy screen.
      expect(Object.keys(answer.body[0]).sort()).toEqual([
        'capacity',
        'endsAt',
        'inPlan',
        'programItemId',
        'registrationEnabled',
        'startsAt',
        'title',
      ]);
    });

    it("reads the titles in the reader's language, falling back field by field (E56)", async () => {
      const german = await plan(mine, '?locale=de');

      expect(german.body[0].title).toBe('Eröffnungsplenum');
      // Nobody translated the other two, so they come as they were written.
      expect(german.body[1].title).toContain('Workshop');
    });

    it('reads the originals when nobody named a language', async () => {
      expect((await plan()).body[0].title).toBe('Opening plenary');
    });

    it('refuses what is not a language tag, and accepts one nobody translated', async () => {
      expect((await plan(mine, '?locale=de-DE-!')).status).toBe(400);
      expect((await plan(mine, '?locale=fr')).status).toBe(200);
    });

    it('is an empty list for an event nobody has, not a refusal', async () => {
      const answer = await api<PlanRow[]>(
        `/api/participant/plugins/${PLUGIN}/events/${NOWHERE}/plan`,
        asSession(mine),
      );

      // The contract publishes no port for an event's existence, so a plug-in
      // that invented the 404 would be answering about something it cannot see.
      expect(answer.status).toBe(200);
      expect(answer.body).toEqual([]);
    });

    it('needs a session', async () => {
      expect(
        (
          await api(
            `/api/participant/plugins/${PLUGIN}/events/${event.id}/plan`,
          )
        ).status,
      ).toBe(401);
    });
  });

  describe('putting a session in a plan (FR 3.17)', () => {
    it('answers 204 and marks the row', async () => {
      expect((await put(workshop.id)).status).toBe(204);

      expect((await rowFor(workshop.id)).inPlan).toBe(true);
    });

    it('books no seat — the number the programme shows does not move (E55)', async () => {
      const before = await publicProgram();
      expect(
        before.body.find((one) => one.id === workshop.id)?.signupCount,
      ).toBe(0);

      // The whole point of this plug-in, decided against the table that would
      // have to change if it were wrong: `program_item_signup` is untouched.
      await put(plenary.id);
      await put(open.id);

      const after = await publicProgram();
      expect(after.body.map((one) => one.signupCount)).toEqual([0, 0, 0]);
      expect(after.body.find((one) => one.id === workshop.id)?.capacity).toBe(
        12,
      );
    });

    it('is the same answer the second time, and still one row', async () => {
      expect((await put(workshop.id)).status).toBe(204);

      const answer = await plan();
      expect(
        answer.body.filter((row) => row.programItemId === workshop.id),
      ).toHaveLength(1);
      expect((await rowFor(workshop.id)).inPlan).toBe(true);
    });

    it('lets two people hold the same one-seat session in their plans', async () => {
      expect((await put(workshop.id, theirs)).status).toBe(204);

      // Both are right: a plan reserves nothing, and the seat is taken in the
      // event's programme (E55).
      expect((await rowFor(workshop.id, mine)).inPlan).toBe(true);
      expect((await rowFor(workshop.id, theirs)).inPlan).toBe(true);
      expect(
        (await publicProgram()).body.find((one) => one.id === workshop.id)
          ?.signupCount,
      ).toBe(0);
    });

    it("keeps one person's plan out of another's", async () => {
      // `mine` has all three; `theirs` has only the workshop.
      const others = await plan(theirs);

      expect(others.body.filter((row) => row.inPlan)).toHaveLength(1);
    });

    it('refuses a session nobody has', async () => {
      expect((await put(NOWHERE)).status).toBe(404);
    });

    it('needs a session', async () => {
      expect(
        (
          await api(
            `/api/participant/plugins/${PLUGIN}/program-items/${plenary.id}`,
            { method: 'PUT' },
          )
        ).status,
      ).toBe(401);
    });
  });

  describe('taking a session out (FR 3.17)', () => {
    it('answers 204 and unmarks the row', async () => {
      expect((await drop(open.id)).status).toBe(204);

      expect((await rowFor(open.id)).inPlan).toBe(false);
    });

    it('is content the second time, and with a session that was never in', async () => {
      // The caller asked for a state, and that state is what they get: a retry
      // after a lost connection must not look like a mistake.
      expect((await drop(open.id)).status).toBe(204);
      expect((await drop(NOWHERE)).status).toBe(204);
    });

    it('cancels nothing in the programme', async () => {
      expect(
        (await publicProgram()).body.every((one) => one.signupCount === 0),
      ).toBe(true);
    });

    it('needs a session', async () => {
      expect(
        (
          await api(
            `/api/participant/plugins/${PLUGIN}/program-items/${plenary.id}`,
            { method: 'DELETE' },
          )
        ).status,
      ).toBe(401);
    });
  });

  describe('the port the personal plan grew a field on (E56, AP 9)', () => {
    it('still hands a room plan the originals, whatever a participant reads', async () => {
      expect((await toggle(true, 'room-planning')).status).toBe(200);

      const schedule = await api<RoomPlan>(
        `/api/admin/plugins/room-planning/events/${event.id}/schedule`,
        { headers: { cookie } },
      );

      // The regression this package could have caused: an organizer works in
      // the language of their instance, and the plug-in that has used this
      // port since AP 6 asks with no language at all.
      expect(schedule.status).toBe(200);
      expect(
        schedule.body.sessions.find((one) => one.programItemId === plenary.id)
          ?.title,
      ).toBe('Opening plenary');

      expect(
        (await toggle(roomPlanningWasEnabled, 'room-planning')).status,
      ).toBe(200);
    });
  });

  describe('switched off again', () => {
    it('loses no plan, and gives every route back to the 404 (E14)', async () => {
      expect((await toggle(false)).status).toBe(200);
      expect((await plan()).status).toBe(404);

      expect((await toggle(true)).status).toBe(200);
      const answer = await plan();

      // Disabling never deletes: what was ticked before is still ticked.
      expect(
        answer.body.filter((row) => row.inPlan).map((row) => row.programItemId),
      ).toEqual([plenary.id, workshop.id]);
    });
  });
});
