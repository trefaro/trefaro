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
 * Contract of the discussion forum plug-in (FR 4.6) — AP 4 of phase 4.
 *
 * The acceptance criterion of the package is decided here, and most of it can
 * only be decided at this level:
 *
 * - **A thread stands in the list only once a post in it is approved** (F195),
 *   and **a rejected post is visible to its author and the organization and to
 *   nobody else** (E51). Both rules are in SQL (F152), so a unit test with a
 *   fake repository could only prove that the fake filters. Here a second
 *   participant asks the real endpoints.
 * - **The moderation list of one event shows that event's posts** and not the
 *   other event's — decided by the join to the thread, so a second event is
 *   part of the fixture.
 * - **A second plug-in uses the same host port** without the port having been
 *   changed: the names on threads and posts come through `PluginParticipantReads`
 *   as the proposals' do, for accounts that never opted into the directory.
 * - **A disabled plug-in is absent, not forbidden**: every route 404, and no
 *   entry in `/api/config` — and switching it off keeps every row (E14).
 *
 * Instance-wide state, which is why it lives in `apps/server-e2e` and why every
 * test puts back what it found: `module_config` belongs to the instance.
 *
 * Sessions are seeded rather than logged in for, like the proposals suite's:
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

type Status = 'pending' | 'approved' | 'rejected';

interface Thread {
  id: string;
  eventId: string;
  title: string;
  author: Author | null;
  createdAt: string;
  lastPostAt: string;
}

interface Post {
  id: string;
  threadId: string;
  body: string;
  status: Status;
  author: Author | null;
  createdAt: string;
  decidedAt: string | null;
}

interface ModeratedPost extends Post {
  thread: { id: string; title: string };
}

interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface PostPage extends Page<Post> {
  thread: Thread;
}

interface OpenedThread {
  thread: Thread;
  post: Post;
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

const PLUGIN = 'forum';
const NOWHERE = '00000000-0000-4000-8000-000000000000';

/** The `message` of a problem answer, or the body as it came (F77). */
function problem(body: unknown): string {
  const message = (body as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : JSON.stringify(body);
}

const stamp = Date.now();
const DOMAIN = `@forum-${stamp}.example.org`;

describe('the discussion forum plug-in', () => {
  let cookie: string;
  let series: Series;
  /** The event the forum is held in, and a second one that must stay quiet. */
  let event: Event;
  let otherEvent: Event;
  /** The person who opens the thread, and a second one who reads and replies. */
  let opener = '';
  let bystander = '';
  let openerId = '';
  let bystanderId = '';

  const asAdminJson = (payload: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  const asParticipant = (session: string): RequestInit => ({
    headers: { cookie: `trefaro_user_session=${session}` },
  });

  const asParticipantJson = (
    session: string,
    payload: unknown,
  ): RequestInit => ({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `trefaro_user_session=${session}`,
    },
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

  const threadsAs = (session: string, query = '', eventId = event.id) =>
    api<Page<Thread>>(
      `/api/participant/plugins/${PLUGIN}/events/${eventId}/threads${query}`,
      asParticipant(session),
    );

  const open = (session: string, payload: unknown, eventId = event.id) =>
    api<OpenedThread>(
      `/api/participant/plugins/${PLUGIN}/events/${eventId}/threads`,
      asParticipantJson(session, payload),
    );

  const postsAs = (session: string, threadId: string, query = '') =>
    api<PostPage>(
      `/api/participant/plugins/${PLUGIN}/threads/${threadId}/posts${query}`,
      asParticipant(session),
    );

  const replyAs = (session: string, threadId: string, payload: unknown) =>
    api<Post>(
      `/api/participant/plugins/${PLUGIN}/threads/${threadId}/posts`,
      asParticipantJson(session, payload),
    );

  const moderationList = (query = '', eventId = event.id) =>
    api<Page<ModeratedPost>>(
      `/api/admin/plugins/${PLUGIN}/events/${eventId}/posts${query}`,
      { headers: { cookie } },
    );

  const decide = (postId: string, decision: 'approval' | 'rejection') =>
    api<ModeratedPost>(
      `/api/admin/plugins/${PLUGIN}/posts/${postId}/${decision}`,
      { method: 'POST', headers: { cookie } },
    );

  const ids = <T extends { id: string }>(page: { rows: T[] }) =>
    page.rows.map((row) => row.id);

  beforeAll(async () => {
    cookie = adminCookie();

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson({
          name: `Forum Contract Series ${stamp}`,
          description: 'Holds the two events this suite discusses in.',
          status: 'published',
        }),
      )
    ).body;

    const newEvent = (name: string) =>
      api<Event>(
        `/api/admin/series/${series.id}/events`,
        asAdminJson({
          name: `${name} ${stamp}`,
          description: 'Its participants talk with each other.',
          eventType: 'onsite',
          startsAt: '2099-06-14T06:00:00.000Z',
          endsAt: '2099-06-14T16:00:00.000Z',
          timezone: 'Europe/Berlin',
          venueName: 'Bürgerhaus Kalk',
          languages: ['de', 'en'],
          status: 'published',
        }),
      );
    event = (await newEvent('Forum Contract Event')).body;
    otherEvent = (await newEvent('Forum Contract Other Event')).body;

    // Neither account is in the directory (`searchable` false): the name port
    // of AP 2 must not require the opt-in (E37), and a run with a listed
    // account would not notice if that changed.
    openerId = await seedProfile({
      email: `opener${DOMAIN}`,
      firstName: 'Amina',
      lastName: 'Okonkwo',
    });
    opener = await seedSession(openerId);
    bystanderId = await seedProfile({
      email: `bystander${DOMAIN}`,
      firstName: 'Jonas',
      lastName: 'Weber',
    });
    bystander = await seedSession(bystanderId);
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
      const [threads, opened, posts, reply, queue, approval, config] =
        await Promise.all([
          threadsAs(opener),
          open(opener, { title: 'Where to meet', body: 'At the entrance?' }),
          postsAs(opener, NOWHERE),
          replyAs(opener, NOWHERE, { body: 'Hello?' }),
          moderationList(),
          decide(NOWHERE, 'approval'),
          api<PublicConfig>('/api/config'),
        ]);

      // Absent rather than forbidden, so a client sees the same thing the API
      // says: nothing here.
      expect([
        threads.status,
        opened.status,
        posts.status,
        reply.status,
        queue.status,
        approval.status,
      ]).toEqual([404, 404, 404, 404, 404, 404]);
      expect(config.body.plugins.map((plugin) => plugin.key)).not.toContain(
        PLUGIN,
      );
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
      expect((await toggle(PLUGIN, true)).status).toBe(200);

      // The mechanism is AP 2's and proven there in both directions; what this
      // plug-in owes is that its descriptor is wired into it.
      const refused = await toggle('profiles', false);

      expect(refused.status).toBe(409);
      expect(problem(refused.body)).toContain(`"${PLUGIN}"`);
      expect((await moduleRow('profiles')).enabled).toBe(true);
    });
  });

  describe('opening a thread (FR 4.6)', () => {
    let opened: OpenedThread;

    it('creates the thread and its first post, pending, with the author named', async () => {
      const created = await open(opener, {
        title: '  Where do we meet on Saturday morning?  ',
        body: '  In front of the main entrance, I would say.  ',
      });

      expect(created.status).toBe(201);
      const author = { id: openerId, name: 'Amina Okonkwo', avatarUrl: null };
      expect(created.body.thread).toMatchObject({
        eventId: event.id,
        // Trimmed on the way in: what a person typed, not what they pasted.
        title: 'Where do we meet on Saturday morning?',
        author,
      });
      expect(created.body.post).toMatchObject({
        threadId: created.body.thread.id,
        body: 'In front of the main entrance, I would say.',
        status: 'pending',
        decidedAt: null,
        author,
      });
      // While nothing is published, the thread's activity is its own creation
      // (F195) — the same instant, because the database wrote both.
      expect(created.body.thread.lastPostAt).toBe(
        created.body.thread.createdAt,
      );
      // A plug-in learns a name and a picture, never an address (F55).
      expect(JSON.stringify(created.body)).not.toContain('@');
      opened = created.body;
    });

    it('refuses a title or a post made of spaces, and an event that is not one', async () => {
      const [blankTitle, blankBody, elsewhere] = await Promise.all([
        open(opener, { title: '   ', body: 'Something' }),
        open(opener, { title: 'Something', body: '\n\t ' }),
        open(opener, { title: 'T', body: 'B' }, NOWHERE),
      ]);

      expect([blankTitle.status, blankBody.status]).toEqual([400, 400]);
      // The database refuses an unknown event, and the plug-in answers 404
      // rather than letting a constraint violation become a 500.
      expect(elsewhere.status).toBe(404);
    });

    it('shows the unpublished thread to its author and to nobody else (F195)', async () => {
      const mine = await threadsAs(opener);
      const theirs = await threadsAs(bystander);

      expect(ids(mine.body)).toContain(opened.thread.id);
      // The whole of the rule: a thread nobody has published anything in is
      // not in a stranger's list.
      expect(ids(theirs.body)).not.toContain(opened.thread.id);
    });

    it('lets its author read it, with the pending post in it', async () => {
      const mine = await postsAs(opener, opened.thread.id);

      expect(mine.status).toBe(200);
      expect(mine.body.thread.id).toBe(opened.thread.id);
      expect(mine.body.rows.map((row) => row.status)).toEqual(['pending']);
      expect(mine.body.total).toBe(1);
    });

    it('is neither readable nor answerable for a stranger — the 404 an unknown id gets', async () => {
      const [read, reply, unknown] = await Promise.all([
        postsAs(bystander, opened.thread.id),
        replyAs(bystander, opened.thread.id, { body: 'Can I join?' }),
        postsAs(bystander, NOWHERE),
      ]);

      expect([read.status, reply.status]).toEqual([404, 404]);
      // Same status, same sentence shape: a guessed id learns nothing.
      expect(problem(read.body)).toBe(
        problem(unknown.body).replace(NOWHERE, opened.thread.id),
      );
    });

    it('puts the post into its event’s queue, in the context of its thread', async () => {
      const queue = await moderationList('?status=pending');
      const elsewhere = await moderationList('', otherEvent.id);

      expect(queue.body.rows).toEqual([
        expect.objectContaining({
          id: opened.post.id,
          status: 'pending',
          thread: {
            id: opened.thread.id,
            title: 'Where do we meet on Saturday morning?',
          },
          author: expect.objectContaining({ name: 'Amina Okonkwo' }),
        }),
      ]);
      // The event is decided by the thread, so the other event's list is empty.
      expect(elsewhere.body).toMatchObject({ rows: [], total: 0 });
    });

    it('needs a session at all — a stranger reads nothing (E58)', async () => {
      const anonymous = await api(
        `/api/participant/plugins/${PLUGIN}/events/${event.id}/threads`,
      );

      // 401 rather than 404: the plug-in is on, and this is the participant
      // guard on the declared path, not the plug-in switch.
      expect(anonymous.status).toBe(401);
    });

    it('does not take a status from a participant — the rule is not a parameter', async () => {
      const asked = await threadsAs(opener, '?status=approved');

      // A parameter that changed nothing would be a promise the endpoint does
      // not keep; declared nowhere, it is a 400 (F94's rule for queries).
      expect(asked.status).toBe(400);
    });
  });

  describe('deciding, post by post (E51)', () => {
    let thread: Thread;
    let first: Post;
    let reply: Post;

    beforeAll(async () => {
      const mine = await threadsAs(opener);
      thread = mine.body.rows[0];
      first = (await postsAs(opener, thread.id)).body.rows[0];
    });

    it('publishes the thread with its first approved post', async () => {
      const approved = await decide(first.id, 'approval');

      expect(approved.status).toBe(200);
      expect(approved.body).toMatchObject({
        id: first.id,
        status: 'approved',
        thread: { id: thread.id, title: thread.title },
      });
      // A decision has a moment (the check constraint refuses any other pair).
      expect(approved.body.decidedAt).not.toBeNull();

      const theirs = await threadsAs(bystander);
      expect(ids(theirs.body)).toContain(thread.id);
      const read = await postsAs(bystander, thread.id);
      expect(read.status).toBe(200);
      expect(read.body.rows).toEqual([
        expect.objectContaining({
          id: first.id,
          status: 'approved',
          author: expect.objectContaining({ name: 'Amina Okonkwo' }),
        }),
      ]);
    });

    it('takes a reply as pending, visible to its author only', async () => {
      const created = await replyAs(bystander, thread.id, {
        body: '  Fine by me — nine o’clock?  ',
      });

      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        threadId: thread.id,
        body: 'Fine by me — nine o’clock?',
        status: 'pending',
        author: { id: bystanderId, name: 'Jonas Weber', avatarUrl: null },
      });
      reply = created.body;

      const theirs = await postsAs(bystander, thread.id);
      const openers = await postsAs(opener, thread.id);
      // The one who wrote it sees it, with its status; the one who opened the
      // thread does not — approved plus one's own, and nothing else.
      expect(ids(theirs.body)).toEqual([first.id, reply.id]);
      expect(theirs.body.total).toBe(2);
      expect(ids(openers.body)).toEqual([first.id]);
      expect(openers.body.total).toBe(1);
    });

    it('keeps a rejected reply for its author and the organization (E14)', async () => {
      const refused = await decide(reply.id, 'rejection');

      expect(refused.body).toMatchObject({
        id: reply.id,
        status: 'rejected',
        // The row stays as it was: a refusal that deleted it would be
        // indistinguishable from a post that never arrived.
        body: 'Fine by me — nine o’clock?',
      });

      const theirs = await postsAs(bystander, thread.id);
      const openers = await postsAs(opener, thread.id);
      const rejected = await moderationList('?status=rejected');
      expect(theirs.body.rows.find((row) => row.id === reply.id)?.status).toBe(
        'rejected',
      );
      expect(ids(openers.body)).not.toContain(reply.id);
      expect(ids(rejected.body)).toEqual([reply.id]);
    });

    it('leaves the thread’s activity where the published posts are (F195)', async () => {
      // A second thread, published later, leads the list …
      const second = (
        await open(bystander, {
          title: 'Car sharing from Bonn',
          body: 'Anyone?',
        })
      ).body;
      await decide(second.post.id, 'approval');
      expect(ids((await threadsAs(opener)).body)).toEqual([
        second.thread.id,
        thread.id,
      ]);

      // … until a reply in the first one is approved, which moves the first
      // thread's activity to that reply's moment …
      const later = (await replyAs(opener, thread.id, { body: 'Nine it is.' }))
        .body;
      await decide(later.id, 'approval');
      const afterReply = await threadsAs(opener);
      expect(ids(afterReply.body)).toEqual([thread.id, second.thread.id]);
      expect(afterReply.body.rows[0].lastPostAt).toBe(later.createdAt);

      // … and a correction moves it back: recomputed from the rows, not
      // incremented. The rejected reply of the test above never counted.
      await decide(later.id, 'rejection');
      const corrected = await threadsAs(opener);
      expect(ids(corrected.body)).toEqual([second.thread.id, thread.id]);
      expect(corrected.body.rows[1].lastPostAt).toBe(first.createdAt);
    });

    it('pages and narrows the moderation list in SQL, and refuses what is not a page', async () => {
      const [all, pending, firstPage, badStatus, badPage] = await Promise.all([
        moderationList(),
        moderationList('?status=pending'),
        moderationList('?page=1&pageSize=1'),
        moderationList('?status=maybe'),
        moderationList('?page=2.7'),
      ]);

      // Four posts in this event's forum by now, none of them waiting.
      expect(all.body.total).toBe(4);
      expect(pending.body).toMatchObject({ rows: [], total: 0 });
      // The window is the server's, and the answer says which one it read.
      expect(firstPage.body).toMatchObject({ page: 1, pageSize: 1, total: 4 });
      expect(firstPage.body.rows).toHaveLength(1);
      expect([badStatus.status, badPage.status]).toEqual([400, 400]);
    });

    it('answers 404 for a post that is not there', async () => {
      expect((await decide(NOWHERE, 'approval')).status).toBe(404);
    });

    it('is behind the administrative session, like every organizer read', async () => {
      // No cookie at all: the path is what puts it there (E16, E57), and a
      // participant's session is not an organizer's.
      const stranger = await api(
        `/api/admin/plugins/${PLUGIN}/events/${event.id}/posts`,
      );
      const participant = await api(
        `/api/admin/plugins/${PLUGIN}/events/${event.id}/posts`,
        asParticipant(opener),
      );

      expect([stranger.status, participant.status]).toEqual([401, 401]);
    });
  });

  describe('switching it off again', () => {
    it('makes every route 404 and loses no row (E14)', async () => {
      expect((await toggle(PLUGIN, false)).status).toBe(200);

      const [threads, queue] = await Promise.all([
        threadsAs(opener),
        moderationList(),
      ]);
      expect([threads.status, queue.status]).toEqual([404, 404]);

      expect((await toggle(PLUGIN, true)).status).toBe(200);
      // The four posts are still there: switching a plug-in off never deletes
      // anything.
      expect((await moderationList()).body.total).toBe(4);
      expect((await threadsAs(opener)).body.total).toBe(2);
    });
  });
});
