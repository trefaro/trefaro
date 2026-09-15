import { adminCookie } from '../support/admin-session';
import { api, refusalOf, type Refusal } from '../support/api-client';
import {
  closeDatabase,
  deleteProfiles,
  deleteSeries,
  seedProfile,
  seedSession,
} from '../support/database';

/**
 * Contract of the programme proposals plug-in (FR 3.13, FR 3.14) — AP 2 of
 * phase 4.
 *
 * The acceptance criterion of the package is decided here, and most of it can
 * only be decided at this level:
 *
 * - **The visibility rule of E51 is in SQL** (F152), so a unit test with a fake
 *   repository could only prove that the fake filters. Here a second
 *   participant asks the real endpoint and does not see a pending proposal.
 * - **A prerequisite is enforced in both directions** (E47) across two
 *   registries: switching the plug-in on without `profiles` is a 409 naming
 *   `profiles`, and switching `profiles` off under the running plug-in is a 409
 *   naming the plug-in. Only a request can show that both refusals happen
 *   before the write.
 * - **A disabled plug-in is absent, not forbidden**: every route 404, and no
 *   entry in `/api/config` — and switching it off keeps every row (E14).
 *
 * AP 3 added the sixth route, `…/summary` — the three counts the section on the
 * organizer's dashboard draws (E59) — and the tests for it are here for the
 * same reason as the rest: what is worth deciding about a count is that it
 * agrees with the rows, that it says zero rather than nothing, and that it
 * moves when a decision does.
 *
 * Instance-wide state, which is why it lives in `apps/server-e2e` and why every
 * test puts back what it found: `module_config` belongs to the instance, and the
 * suites after this one expect `profiles`, `profile-search` and `chat` to
 * answer.
 *
 * Sessions are seeded rather than logged in for, like the real-time suite's:
 * the login limit is twenty per five minutes for the whole run (E4), and it is
 * never relaxed for a test.
 */
interface Series {
  id: string;
}

interface Event {
  id: string;
}

interface Author {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface Proposal {
  id: string;
  eventId: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  author: Author | null;
  createdAt: string;
  decidedAt: string | null;
}

interface ProposalSummary {
  pending: number;
  approved: number;
  rejected: number;
}

interface ProposalPage {
  rows: Proposal[];
  total: number;
  page: number;
  pageSize: number;
}

interface ModuleSummary {
  key: string;
  requires: string[];
  enabled: boolean;
}

interface PublicConfig {
  enabledModules: string[];
  plugins: { key: string }[];
}

const PLUGIN = 'program-proposals';

const stamp = Date.now();
const DOMAIN = `@proposals-${stamp}.example.org`;

describe('the programme proposals plug-in', () => {
  let cookie: string;
  let series: Series;
  let event: Event;
  /** The person who proposes, and a second one who reads the same list. */
  let proposer = '';
  let bystander = '';
  let proposerId = '';

  const asAdminJson = (payload: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  const toggle = (key: string, enabled: boolean) =>
    api<unknown>(`/api/admin/modules/${key}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ enabled }),
    });

  const moduleRow = async (key: string): Promise<ModuleSummary> => {
    const list = await api<ModuleSummary[]>('/api/admin/modules', {
      headers: { cookie },
    });
    const found = list.body.find((module) => module.key === key);
    if (!found) throw new Error(`No module "${key}" in the list`);
    return found;
  };

  /** The participant's list, as one of the two seeded people. */
  const listAs = (session: string, query = '') =>
    api<ProposalPage>(
      `/api/participant/plugins/${PLUGIN}/events/${event.id}/proposals${query}`,
      { headers: { cookie: `trefaro_user_session=${session}` } },
    );

  const propose = (session: string, payload: unknown) =>
    api<Proposal>(
      `/api/participant/plugins/${PLUGIN}/events/${event.id}/proposals`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `trefaro_user_session=${session}`,
        },
        body: JSON.stringify(payload),
      },
    );

  const moderationList = (query = '') =>
    api<ProposalPage>(
      `/api/admin/plugins/${PLUGIN}/events/${event.id}/proposals${query}`,
      { headers: { cookie } },
    );

  const summary = (headers: Record<string, string> = { cookie }) =>
    api<ProposalSummary>(
      `/api/admin/plugins/${PLUGIN}/events/${event.id}/summary`,
      { headers },
    );

  const decide = (proposalId: string, decision: 'approval' | 'rejection') =>
    api<Proposal>(
      `/api/admin/plugins/${PLUGIN}/proposals/${proposalId}/${decision}`,
      { method: 'POST', headers: { cookie } },
    );

  beforeAll(async () => {
    cookie = adminCookie();

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson({
          name: `Proposals Contract Series ${stamp}`,
          description: 'Holds the event this suite proposes sessions for.',
          status: 'published',
        }),
      )
    ).body;

    event = (
      await api<Event>(
        `/api/admin/series/${series.id}/events`,
        asAdminJson({
          name: `Proposals Contract Event ${stamp}`,
          description: 'Its participants suggest programme items.',
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

    proposerId = await seedProfile({
      email: `proposer${DOMAIN}`,
      firstName: 'Amina',
      lastName: 'Okonkwo',
    });
    proposer = await seedSession(proposerId);
    bystander = await seedSession(
      await seedProfile({
        email: `bystander${DOMAIN}`,
        firstName: 'Jonas',
        lastName: 'Weber',
      }),
    );
  });

  afterAll(async () => {
    // Everything this suite touched, back as it was — the plug-in off, the
    // three core modules on.
    await toggle(PLUGIN, false);
    for (const key of ['profiles', 'profile-search', 'chat']) {
      await toggle(key, true);
    }
    await deleteSeries(series.id);
    await deleteProfiles(DOMAIN);
    await closeDatabase();
  });

  describe('while the organization has it switched off', () => {
    it('answers 404 on every route and appears in no configuration', async () => {
      const [participantList, submission, adminList, counts, approval, config] =
        await Promise.all([
          listAs(proposer),
          propose(proposer, { title: 'A workshop', description: 'Half a day' }),
          moderationList(),
          summary(),
          decide('00000000-0000-4000-8000-000000000000', 'approval'),
          api<PublicConfig>('/api/config'),
        ]);

      // Absent rather than forbidden, so a client sees the same thing the API
      // says: nothing here.
      expect([
        participantList.status,
        submission.status,
        adminList.status,
        counts.status,
        approval.status,
      ]).toEqual([404, 404, 404, 404, 404]);
      expect(config.body.plugins.map((plugin) => plugin.key)).not.toContain(
        PLUGIN,
      );
      expect(config.body.enabledModules).not.toContain(PLUGIN);
    });

    it('is still listed for the organizer, with what it needs (E47)', async () => {
      const row = await moduleRow(PLUGIN);

      // The administration is the one list a disabled module appears in, and
      // the row says what to switch on first — before the click, not after it.
      expect(row).toMatchObject({ enabled: false, requires: ['profiles'] });
    });
  });

  /**
   * The chain is set up once, in `beforeAll`, and undone there as well.
   *
   * Not inside the tests: `profiles` off is instance-wide state, and an
   * assertion that failed halfway would leave every suite after this one
   * without accounts. So the requests are made first, their answers captured,
   * and the instance put back before a single `expect` runs.
   */
  describe('the prerequisite, in both directions (E47)', () => {
    let refusedOn: { status: number; refusal: Refusal | null };
    let stayedOff = true;
    /** Whether accounts could be withdrawn at all once nothing needed them. */
    let accountsWentOff = 0;

    beforeAll(async () => {
      // `profiles` cannot go until what depends on it does — the same rule one
      // family down, and the reason this reads like a chain.
      await toggle('chat', false);
      await toggle('profile-search', false);
      accountsWentOff = (await toggle('profiles', false)).status;

      const refused = await toggle(PLUGIN, true);
      refusedOn = { status: refused.status, refusal: refusalOf(refused.body) };
      stayedOff = (await moduleRow(PLUGIN)).enabled;

      await toggle('profiles', true);
      await toggle('profile-search', true);
      await toggle('chat', true);
    });

    it('refuses to switch the plug-in on while accounts are off, and names them', () => {
      expect(accountsWentOff).toBe(200);
      expect(refusedOn.status).toBe(409);
      // The key, not only a refusal: an organizer has to know which other
      // switch to find, and the key is what the list and `module_config` call
      // the thing. It travels as a value beside the code since AP 5 of phase 5,
      // because the sentence around it is the reader's, not the server's.
      expect(refusedOn.refusal).toEqual({
        code: 'problem.config.moduleRequires.one',
        params: { module: PLUGIN, others: '"profiles"' },
      });
      // Nothing was written: a refused switch leaves the instance as it was.
      expect(stayedOff).toBe(false);
    });

    it('refuses to withdraw accounts under the running plug-in, and names it', async () => {
      expect((await toggle(PLUGIN, true)).status).toBe(200);

      const refused = await toggle('profiles', false);

      expect(refused.status).toBe(409);
      const refusal = refusalOf(refused.body);
      expect(refusal?.code).toBe('problem.config.moduleDependants.many');
      expect(String(refusal?.params['others'])).toContain(`"${PLUGIN}"`);
      expect((await moduleRow('profiles')).enabled).toBe(true);
    });
  });

  describe('proposing and moderating (FR 3.13, FR 3.14)', () => {
    let pending: Proposal;
    let rejected: Proposal;

    it('creates a proposal as pending, with its author named and no address', async () => {
      const created = await propose(proposer, {
        title: '  A workshop on election observation  ',
        description: '  Half a day, hands on.  ',
      });

      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        eventId: event.id,
        // Trimmed on the way in: what a person typed, not what they pasted.
        title: 'A workshop on election observation',
        description: 'Half a day, hands on.',
        status: 'pending',
        decidedAt: null,
        author: { id: proposerId, name: 'Amina Okonkwo', avatarUrl: null },
      });
      // A plug-in learns a name and a picture, never an address (F55).
      expect(JSON.stringify(created.body)).not.toContain('@');
      pending = created.body;
    });

    it('refuses a proposal made of spaces, and one for an event that is not one', async () => {
      const blank = await propose(proposer, {
        title: '   ',
        description: 'Something',
      });
      const elsewhere = await api(
        `/api/participant/plugins/${PLUGIN}/events/00000000-0000-4000-8000-000000000000/proposals`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `trefaro_user_session=${proposer}`,
          },
          body: JSON.stringify({ title: 'T', description: 'D' }),
        },
      );

      expect(blank.status).toBe(400);
      // The database refuses an unknown event, and the plug-in answers 404
      // rather than letting a constraint violation become a 500.
      expect(elsewhere.status).toBe(404);
    });

    it('shows a pending proposal to its author and to nobody else (E51)', async () => {
      const mine = await listAs(proposer);
      const theirs = await listAs(bystander);
      const organizer = await moderationList('?status=pending');

      expect(mine.body.rows.map((row) => row.id)).toContain(pending.id);
      // The whole of the rule, and the one thing that would publish a row
      // nobody decided on: a stranger's pending proposal is not in the list.
      expect(theirs.body.rows.map((row) => row.id)).not.toContain(pending.id);
      // The organization moderates, so it sees its own event's queue.
      expect(organizer.body.rows.map((row) => row.id)).toContain(pending.id);
    });

    it('needs a session at all — a stranger reads nothing (E58)', async () => {
      const anonymous = await api(
        `/api/participant/plugins/${PLUGIN}/events/${event.id}/proposals`,
      );

      // 401 rather than 404: the plug-in is on, and this is the participant
      // guard on the declared path, not the plug-in switch.
      expect(anonymous.status).toBe(401);
    });

    it('brings an approved proposal into everybody’s list', async () => {
      const approved = await decide(pending.id, 'approval');

      expect(approved.status).toBe(200);
      expect(approved.body).toMatchObject({
        id: pending.id,
        status: 'approved',
      });
      // A decision has a moment (the check constraint refuses any other pair).
      expect(approved.body.decidedAt).not.toBeNull();

      const theirs = await listAs(bystander);
      expect(
        theirs.body.rows.find((row) => row.id === pending.id),
      ).toMatchObject({
        status: 'approved',
        author: { name: 'Amina Okonkwo' },
      });
    });

    it('keeps a rejected proposal, with its status, for its author (E14, FR 3.14)', async () => {
      rejected = (
        await propose(proposer, {
          title: 'A second idea',
          description: 'Shorter.',
        })
      ).body;

      const refused = await decide(rejected.id, 'rejection');

      expect(refused.body).toMatchObject({
        id: rejected.id,
        status: 'rejected',
        // The row stays as it was: a refusal that deleted it would be
        // indistinguishable from a submission that never arrived.
        title: 'A second idea',
      });

      const mine = await listAs(proposer);
      const theirs = await listAs(bystander);
      expect(mine.body.rows.find((row) => row.id === rejected.id)?.status).toBe(
        'rejected',
      );
      expect(theirs.body.rows.map((row) => row.id)).not.toContain(rejected.id);
    });

    it('does not turn an approved proposal into a programme item (E52)', async () => {
      const program = await api<{ id: string; title: string }[]>(
        `/api/admin/events/${event.id}/program-items`,
        { headers: { cookie } },
      );

      // The approval publishes the proposal; creating the session stays the
      // organizer's own action in the editor. A plug-in writes no core table.
      expect(program.status).toBe(200);
      expect(program.body).toEqual([]);
    });

    it('pages and narrows the moderation list in SQL', async () => {
      const all = await moderationList();
      const onlyRejected = await moderationList('?status=rejected');
      const firstPage = await moderationList('?page=1&pageSize=1');

      expect(all.body.total).toBe(2);
      expect(onlyRejected.body.rows.map((row) => row.status)).toEqual([
        'rejected',
      ]);
      // The window is the server's, and the answer says which one it read.
      expect(firstPage.body).toMatchObject({
        page: 1,
        pageSize: 1,
        total: 2,
      });
      expect(firstPage.body.rows).toHaveLength(1);
      // Newest first, so the second idea leads.
      expect(firstPage.body.rows[0].id).toBe(rejected.id);
    });

    it('refuses a page and a status that are not ones', async () => {
      const [badStatus, badPage] = await Promise.all([
        moderationList('?status=maybe'),
        moderationList('?page=2.7'),
      ]);

      expect([badStatus.status, badPage.status]).toEqual([400, 400]);
    });

    it('counts each state for the dashboard section (E59)', async () => {
      const counts = await summary();

      // One approved and one rejected by the tests above, and nothing waiting.
      // The zero is present rather than missing: `GROUP BY` answers with what
      // is there, and a heading needs all three numbers.
      expect(counts.body).toEqual({ pending: 0, approved: 1, rejected: 1 });
      // And it is the same truth the list tells, counted in one statement
      // rather than by fetching three pages for three numbers.
      expect((await moderationList()).body.total).toBe(2);
    });

    it('moves those counts when a decision is corrected (E51)', async () => {
      // Re-deciding rather than proposing again: a third row would change what
      // the tests after this one were written against, and a correction is
      // something FR 3.14 allows anyway — the instant moves with it.
      expect((await decide(rejected.id, 'approval')).status).toBe(200);

      expect((await summary()).body).toEqual({
        pending: 0,
        approved: 2,
        rejected: 0,
      });

      expect((await decide(rejected.id, 'rejection')).status).toBe(200);
      expect((await summary()).body).toEqual({
        pending: 0,
        approved: 1,
        rejected: 1,
      });
    });

    it('is behind the administrative session, like every organizer read', async () => {
      // No cookie at all: the path is what puts it there (E16, E57), and a
      // participant's session is not an organizer's.
      const stranger = await summary({});

      expect(stranger.status).toBe(401);
    });
  });

  describe('switching it off again', () => {
    it('makes every route 404 and loses no row (E14)', async () => {
      expect((await toggle(PLUGIN, false)).status).toBe(200);

      const [gone, countsGone] = await Promise.all([
        moderationList(),
        summary(),
      ]);
      expect([gone.status, countsGone.status]).toEqual([404, 404]);

      expect((await toggle(PLUGIN, true)).status).toBe(200);
      const back = await moderationList();
      // The two proposals are still there: switching a plug-in off never
      // deletes anything.
      expect(back.body.total).toBe(2);
    });
  });
});
