import { adminCookie, cookieFrom } from '../support/admin-session';
import { api, postJson } from '../support/api-client';
import {
  closeDatabase,
  deleteProfiles,
  seedProfile,
} from '../support/database';
import {
  accountConfirmationTokenFrom,
  clearMailbox,
  waitForMailTo,
  waitForMailpit,
} from '../support/mailpit';

/**
 * Contract of AP 5: finding other participants (FR 4.4 — E37, F13, F126).
 *
 * The acceptance criterion of the package is decided here, and its first half
 * is the one the thesis is emphatic about: **a profile that did not opt in
 * appears in no answer at all** — not in the list, and not under its own id.
 * Two of the rows that prove it cannot be produced through the API, because
 * `searchable` is only writable behind a session and a session only exists
 * after a confirmed address (E32); they are seeded, which is what
 * `seedProfile` exists for.
 *
 * The rest:
 *
 * - **Two words demand both** (F32, F126), and a word may match the name or the
 *   field of activity. The second box narrows to the field of activity alone
 *   (E36) — a name typed into it finds nobody, which is the difference between
 *   two boxes and one.
 * - **The reader is not in their own results**, and the count says so too.
 * - **No answer carries an address** (F55). A participant reaches another
 *   participant through a conversation, never through a mailbox this endpoint
 *   handed over.
 * - **A hidden profile and an unknown id are one sentence** (F124): whoever
 *   holds an id holds the picture with it, so which ids exist is nobody's to
 *   enumerate.
 * - **The module switch answers before the handler** (F53), and switching it
 *   back on is this suite's own job — `module_config` belongs to the instance.
 *
 * The prerequisite of E42 (`profile-search` needs `profiles`) is asserted where
 * it is switched, in `modules.spec.ts`.
 */
interface Hit {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  activityAreas: string | null;
}

interface Profile extends Hit {
  customFields: Record<string, string | boolean>;
}

interface Page {
  rows: Hit[];
  total: number;
  page: number;
  pageSize: number;
}

interface SessionInfo {
  participant: { id: string; email: string };
  expiresAt: string;
}

interface Module {
  key: string;
  enabled: boolean;
  requires: string[];
}

const USER_SESSION_COOKIE = 'trefaro_user_session';
const PASSWORD = 'a-long-enough-passphrase';

/** Unique per run: a leftover row must not be able to answer an assertion. */
const stamp = Date.now();
const DOMAIN = '@psearch.example.org';
/**
 * A word that only this run's fixtures carry.
 *
 * Every seeded profile has it in its field of activity, and every search below
 * asks for it. Without that, a profile another suite left behind — or a real
 * one in a developer's database — would be counted into a total this suite
 * asserts exactly.
 */
const MARK = `psearch${stamp}`;

describe('the participant search', () => {
  let cookie = '';
  let admin = '';
  let reader = '';
  const ids: Record<string, string> = {};

  const search = (query: string, session = cookie) =>
    api<Page>(`/api/participant/profiles${query}`, {
      headers: { cookie: session },
    });

  const one = (id: string, session = cookie) =>
    api<Profile>(`/api/participant/profiles/${id}`, {
      headers: { cookie: session },
    });

  const names = (page: Page): string[] =>
    page.rows.map((row) => `${row.firstName} ${row.lastName}`);

  const setModule = (key: string, enabled: boolean) =>
    api<Module>(`/api/admin/modules/${key}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: admin },
      body: JSON.stringify({ enabled }),
    });

  beforeAll(async () => {
    await waitForMailpit();
    admin = await adminCookie();

    // The one real account of this suite — the reader. Registering, confirming
    // and logging in is the only way to hold a session (E32), and one session
    // is all a directory needs: everybody who is found is seeded.
    const email = `reader-${stamp}${DOMAIN}`;
    await clearMailbox();
    await postJson('/api/user/profiles', {
      email,
      password: PASSWORD,
      firstName: 'Rea',
      lastName: 'Zzz-Reader',
    });
    await postJson('/api/user/profiles/confirm', {
      token: accountConfirmationTokenFrom(await waitForMailTo(email)),
    });
    const login = await postJson<SessionInfo>('/api/participant/auth/login', {
      email,
      password: PASSWORD,
    });
    cookie = cookieFrom(login.headers, USER_SESSION_COOKIE);
    reader = login.body.participant.id;

    // The reader opts in as well, so "not in their own results" is a claim
    // about the query rather than about a flag that happened to be off.
    await api('/api/participant/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        searchable: true,
        activityAreas: `${MARK} election observation`,
      }),
    });

    ids['amina'] = await seedProfile({
      email: `amina-${stamp}${DOMAIN}`,
      firstName: 'Amina',
      lastName: 'Okonkwo',
      activityAreas: `${MARK} citizens assemblies`,
      searchable: true,
      customFields: { 'local-group': 'Cologne', mentoring: true },
    });
    ids['bo'] = await seedProfile({
      email: `bo-${stamp}${DOMAIN}`,
      firstName: 'Bo',
      lastName: 'Adeyemi',
      activityAreas: `${MARK} election observation`,
      searchable: true,
    });
    ids['eze'] = await seedProfile({
      email: `eze-${stamp}${DOMAIN}`,
      firstName: 'Eze',
      lastName: 'Balogun',
      activityAreas: `${MARK} citizens assemblies`,
      searchable: true,
    });
    // The two that must not appear anywhere: one who never opted in, and one
    // who did but whose address has not answered yet (E32).
    ids['hidden'] = await seedProfile({
      email: `hidden-${stamp}${DOMAIN}`,
      firstName: 'Chen',
      lastName: 'Okonkwo',
      activityAreas: `${MARK} election observation`,
      searchable: false,
    });
    ids['unconfirmed'] = await seedProfile({
      email: `unconfirmed-${stamp}${DOMAIN}`,
      firstName: 'Dalia',
      lastName: 'Nkemelu',
      activityAreas: `${MARK} election observation`,
      searchable: true,
      confirmed: false,
    });
  });

  afterAll(async () => {
    // The address is unique instance-wide (E31), so a leftover row would send
    // the next run down a different branch.
    await deleteProfiles(DOMAIN);
    await closeDatabase();
  });

  it('needs a session, like everything under /api/participant', async () => {
    const { status } = await api(`/api/participant/profiles?search=${MARK}`);

    expect(status).toBe(401);
  });

  it('finds only the profiles whose owner opted in (E37, F13)', async () => {
    const { status, body } = await search(`?search=${MARK}`);

    expect(status).toBe(200);
    // Chen did not opt in and Dalia never confirmed; the reader is themselves.
    expect(names(body).sort()).toEqual([
      'Amina Okonkwo',
      'Bo Adeyemi',
      'Eze Balogun',
    ]);
    // The count is the whole result, and it must not include what the rows do
    // not: a total of four with three rows would be a directory hinting at a
    // fourth person.
    expect(body.total).toBe(3);
  });

  it('leaves the reader out of their own search', async () => {
    const { body } = await search(`?search=${MARK}`);

    expect(body.rows.map((row) => row.id)).not.toContain(reader);
  });

  it('demands every word, in the name or the field of activity', async () => {
    // One word from the field of activity and one from the name: both match
    // Amina, and the two words together match nobody else.
    const both = await search(`?search=${MARK}%20okonkwo`);
    expect(names(both.body)).toEqual(['Amina Okonkwo']);

    // Chen is an Okonkwo too and would be the second hit if the opt-in were a
    // filter somebody has to remember rather than part of the query.
    expect(both.body.total).toBe(1);

    // Two words that no single profile carries together: the search finds
    // nothing rather than everything that matches either of them.
    const neither = await search(`?search=okonkwo%20balogun`);
    expect(neither.body.rows).toEqual([]);
    expect(neither.body.total).toBe(0);
  });

  it('matches a word against the field of activity as well as the name', async () => {
    const { body } = await search(`?search=${MARK}%20assemblies`);

    expect(names(body).sort()).toEqual(['Amina Okonkwo', 'Eze Balogun']);
  });

  it('narrows the second box to the field of activity alone (E36)', async () => {
    const areas = await search(
      `?search=${MARK}&activityAreas=election%20observation`,
    );
    expect(names(areas.body)).toEqual(['Bo Adeyemi']);

    // A name is not a field of activity: the second box is a different
    // question, which is why it is a second box and not a syntax.
    const name = await search(`?search=${MARK}&activityAreas=okonkwo`);
    expect(name.body.rows).toEqual([]);
  });

  it('is a directory when both boxes are empty', async () => {
    // Everybody who opted in, browsable — a search that answers nothing until
    // it is asked something hides a community from the people in it.
    const { body } = await search('');

    expect(body.rows.length).toBeGreaterThanOrEqual(3);
    expect(body.rows.map((row) => row.id)).not.toContain(ids['hidden']);
  });

  it('sorts by last name, then first name, with the id last', async () => {
    const { body } = await search(`?search=${MARK}`);

    expect(names(body)).toEqual(['Bo Adeyemi', 'Eze Balogun', 'Amina Okonkwo']);
  });

  it('pages server-side and counts the whole result', async () => {
    const second = await search(`?search=${MARK}&page=2&pageSize=1`);

    expect(names(second.body)).toEqual(['Eze Balogun']);
    expect(second.body).toMatchObject({ total: 3, page: 2, pageSize: 1 });
  });

  it('caps the page size and says which one it used', async () => {
    const { body } = await search(`?search=${MARK}&pageSize=5000`);

    expect(body.pageSize).toBe(50);
  });

  it('refuses a page that is not one, and a parameter it does not know', async () => {
    const zeroth = await search(`?search=${MARK}&page=0`);
    expect(zeroth.status).toBe(400);

    // `forbidNonWhitelisted` judges the whole query string. `?locale=` is
    // deliberately not declared here: nothing in this answer is translated, and
    // a parameter that changed nothing would be a promise that it does.
    const localised = await search(`?search=${MARK}&locale=de`);
    expect(localised.status).toBe(400);
  });

  it('carries no address anywhere in the answer (F55)', async () => {
    const list = await search(`?search=${MARK}`);
    const profile = await one(ids['amina']);

    // The fixtures all have an address, and none of it may be in either shape:
    // the community search is not an export of the community.
    expect(JSON.stringify(list.body)).not.toContain('@');
    expect(JSON.stringify(profile.body)).not.toContain('@');
  });

  it('answers a row without the profile questions and a profile with them', async () => {
    const list = await search(`?search=${MARK}%20okonkwo`);
    const profile = await one(ids['amina']);

    expect(list.body.rows[0]).not.toHaveProperty('customFields');
    expect(profile.body.customFields).toEqual({
      'local-group': 'Cologne',
      mentoring: true,
    });
    // The picture's address never carries the stored path (F124) — there is no
    // picture on these fixtures, so `null` is the whole assertion.
    expect(profile.body.avatarUrl).toBeNull();
  });

  it('says the same thing about a hidden profile, an unconfirmed one and an unknown id', async () => {
    const hidden = await one(ids['hidden']);
    const unconfirmed = await one(ids['unconfirmed']);
    const unknown = await one('3f2504e0-4f89-11d3-9a0c-0305e82c3301');

    expect([hidden.status, unconfirmed.status, unknown.status]).toEqual([
      404, 404, 404,
    ]);
    // Word for word. An error body carries a timestamp, so only the message is
    // compared (see `docs/rules/e2e-tests.md`).
    const message = (answer: { body: unknown }): unknown =>
      (answer.body as { message?: unknown }).message;
    expect(message(hidden)).toEqual(message(unknown));
    expect(message(unconfirmed)).toEqual(message(unknown));
  });

  it('lets somebody open their own entry — the rule is about the profile', async () => {
    const { status, body } = await one(reader);

    expect(status).toBe(200);
    expect(body.id).toBe(reader);
  });

  it('refuses an id that is not one before it asks anything', async () => {
    const { status } = await one('not-a-uuid');

    expect(status).toBe(400);
  });

  it('answers 404 while the module is switched off (F53)', async () => {
    const before = await setModule('profile-search', false);
    expect(before.body.enabled).toBe(false);

    try {
      // With a valid session, so this is the module's answer and not the
      // guard's: an organization that keeps accounts but no directory.
      const list = await search(`?search=${MARK}`);
      const profile = await one(ids['amina']);

      expect([list.status, profile.status]).toEqual([404, 404]);
    } finally {
      // `module_config` belongs to the instance, and the suites after this one
      // expect the search to answer.
      const after = await setModule('profile-search', true);
      expect(after.body.enabled).toBe(true);
    }
  });
});
