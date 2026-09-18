import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adminCookie, cookieFrom } from '../support/admin-session';
import { api, postJson } from '../support/api-client';
import {
  closeDatabase,
  conversationMemberCount,
  deleteProfiles,
  deleteSeries,
  messageCount,
  profileExists,
  registrationCount,
  seedProfile,
  seedRegistrations,
  seedSession,
  sessionCount,
  threadOpener,
} from '../support/database';
import {
  accountConfirmationTokenFrom,
  clearMailbox,
  waitForMailTo,
  waitForMailpit,
} from '../support/mailpit';

/**
 * Contract of the export and the erasure (E65) — AP 6 of phase 5.
 *
 * The acceptance criterion of the package, clause by clause, and every one of
 * them needs a request and a second look into the database:
 *
 * 1. **A person gets their export and nothing that is stored about them is
 *    missing from it.** Asserted by unpacking the archive with a reader this
 *    project did not write and looking for the account, the registration made
 *    with the same address, and the conversation.
 * 2. **The account can be deleted**, and only with the right password.
 * 3. **A conversation is still readable after the other side is gone, and it
 *    names nobody.** The other member reads the same history; the counterparts
 *    are empty; the rows are still there.
 * 4. **A thread with an erased opener stands, replies of others included** —
 *    the one foreign key AP 6 had to change, and the only way to see it is to
 *    erase somebody who opened one.
 * 5. **Nothing of it touches a plug-in's table from the core.** Visible as the
 *    absence of a statement, so what is asserted instead is its consequence:
 *    the thread's `created_by` is `NULL` and its posts by other people are
 *    still readable, which only the plug-in's own foreign key can produce.
 *
 * Two accounts are registered through the real flow rather than seeded, and
 * that costs two of the twenty logins this run has (E4): a deletion is
 * authorized by a password, and a seeded row carries a hash nothing can verify.
 */
interface Account {
  id: string;
  email: string;
}

interface SessionInfo {
  participant: Account;
  expiresAt: string;
}

interface Series {
  id: string;
}

interface Event {
  id: string;
}

interface Conversation {
  id: string;
  type: string;
  counterparts: { profileId: string | null; name: string }[];
}

interface Page<T> {
  rows: T[];
  total: number;
}

interface Message {
  id: string;
  body: string | null;
  senderId: string | null;
}

interface Thread {
  id: string;
  author: { id: string } | null;
}

interface Post {
  id: string;
  body: string;
  status: string;
}

interface OpenedThread {
  thread: Thread;
  post: Post;
}

interface PostPage extends Page<Post> {
  thread: Thread;
}

interface ExportedAccount {
  id: string;
  email: string;
  firstName: string;
  profilePicture: string | null;
}

interface ExportPayload {
  exportedAt: string;
  account: ExportedAccount;
  registrations: { event: { slug: string }; email: string }[];
  conversations: {
    id: string;
    messages: { mine: boolean; body: string | null }[];
  }[];
  newsletterSubscriptions: unknown[];
  sessions: unknown[];
}

const USER_SESSION_COOKIE = 'trefaro_user_session';
const BASE_URL = `http://127.0.0.1:${process.env['SERVER_PORT'] ?? '3000'}`;
const PASSWORD = 'a-long-enough-passphrase';
const PLUGIN = 'forum';

const stamp = Date.now();
const DOMAIN = `@privacy-${stamp}.example.org`;

/** A real PNG header, so the server's signature check decides as it would live. */
const png = (): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(64, 0x2a),
  ]);

/**
 * Unpacks the archive with Python's `zipfile`.
 *
 * The same independent reader the writer's unit test uses, and for the same
 * reason: a ZIP written by hand has to be opened by something that was not, or
 * the test agrees with the mistake. `extractall` checks every entry's CRC.
 */
function unpack(archive: Buffer): Record<string, string> {
  const dir = mkdtempSync(join(tmpdir(), 'trefaro-export-'));
  try {
    const file = join(dir, 'archive.zip');
    writeFileSync(file, archive);
    return JSON.parse(
      execFileSync(
        'python3',
        [
          '-c',
          'import sys, zipfile, json\n' +
            'z = zipfile.ZipFile(sys.argv[1])\n' +
            'z.testzip()\n' +
            'print(json.dumps({n: z.read(n).decode("utf8", "replace") for n in z.namelist()}))',
          file,
        ],
        { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
      ),
    ) as Record<string, string>;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('the export and the erasure', () => {
  let admin = '';
  let series: Series;
  let event: Event;

  /** The person who erases themselves, through the real flow — password and all. */
  let owner = '';
  let ownerId = '';
  let ownerEmail = '';
  /** The other side of the conversation and the author of the surviving reply. */
  let friend = '';
  let friendId = '';

  let conversationId = '';
  let threadId = '';
  let replyId = '';

  const asAdminJson = (payload: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: admin },
    body: JSON.stringify(payload),
  });

  const asParticipant = (session: string): RequestInit => ({
    headers: { cookie: session },
  });

  const asParticipantJson = (
    session: string,
    payload: unknown,
    method = 'POST',
  ): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie: session },
    body: JSON.stringify(payload),
  });

  const toggle = (key: string, enabled: boolean) =>
    api<unknown>(`/api/admin/modules/${key}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: admin },
      body: JSON.stringify({ enabled }),
    });

  /** Registers, confirms and logs in — the only way to hold a password (E32). */
  const signUp = async (
    name: string,
  ): Promise<{ cookie: string; id: string; email: string }> => {
    const email = `${name}${DOMAIN}`;
    await clearMailbox();
    await postJson('/api/user/profiles', {
      email,
      password: PASSWORD,
      firstName: 'Amina',
      lastName: 'Okonkwo',
      preferredLocale: 'de',
    });
    await postJson('/api/user/profiles/confirm', {
      token: accountConfirmationTokenFrom(await waitForMailTo(email)),
    });
    const login = await postJson<SessionInfo>('/api/participant/auth/login', {
      email,
      password: PASSWORD,
    });
    return {
      cookie: cookieFrom(login.headers, USER_SESSION_COOKIE),
      id: login.body.participant.id,
      email,
    };
  };

  const exportArchive = async (session: string) => {
    const response = await fetch(`${BASE_URL}/api/participant/me/export`, {
      headers: { cookie: session },
    });
    return {
      status: response.status,
      type: response.headers.get('content-type'),
      disposition: response.headers.get('content-disposition'),
      bytes: Buffer.from(await response.arrayBuffer()),
    };
  };

  const eraseWith = (session: string, password: string) =>
    api<unknown>('/api/participant/me', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', cookie: session },
      body: JSON.stringify({ password }),
    });

  beforeAll(async () => {
    await waitForMailpit();
    admin = adminCookie();
    await toggle(PLUGIN, true);

    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson({
          name: `Erasure Contract Series ${stamp}`,
          description: 'Holds the event this suite registers for.',
          status: 'published',
        }),
      )
    ).body;
    event = (
      await api<Event>(
        `/api/admin/series/${series.id}/events`,
        asAdminJson({
          name: `Erasure Contract Event ${stamp}`,
          description: 'Its participants talk with each other.',
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

    const account = await signUp('owner');
    owner = account.cookie;
    ownerId = account.id;
    ownerEmail = account.email;

    // A file this person uploaded, so the archive has to carry bytes and not
    // only rows — the half of "nothing missing" that lives on the volume.
    const picture = new FormData();
    picture.set(
      'file',
      new Blob([new Uint8Array(png())], { type: 'image/png' }),
    );
    await api('/api/participant/me/avatar', {
      method: 'PUT',
      headers: { cookie: owner },
      body: picture,
    });

    // The second account is in the directory, because a one-to-one
    // conversation can only be opened with a profile that is (E37).
    friendId = await seedProfile({
      email: `friend${DOMAIN}`,
      firstName: 'Jonas',
      lastName: 'Weber',
      searchable: true,
      // A real password, so this account can erase itself too — without
      // spending one of the twenty logins per five minutes (E4).
      password: PASSWORD,
    });
    friend = `${USER_SESSION_COOKIE}=${await seedSession(friendId)}`;

    // A registration under the same address, written directly: the public form
    // sends a letter per attempt and is rate limited on purpose (E4).
    await seedRegistrations(event.id, [
      {
        email: ownerEmail,
        firstName: 'Amina',
        lastName: 'Okonkwo',
        status: 'confirmed',
      },
    ]);

    const conversation = await api<Conversation>(
      '/api/participant/conversations',
      asParticipantJson(owner, { profileId: friendId }),
    );
    conversationId = conversation.body.id;
    await api<Message>(
      `/api/participant/conversations/${conversationId}/messages`,
      asParticipantJson(owner, { body: 'Kommst du auch?' }),
    );
    await api<Message>(
      `/api/participant/conversations/${conversationId}/messages`,
      asParticipantJson(friend, { body: 'Ja, bis Samstag.' }),
    );

    const opened = await api<OpenedThread>(
      `/api/participant/plugins/${PLUGIN}/events/${event.id}/threads`,
      asParticipantJson(owner, {
        title: 'Wo treffen wir uns?',
        body: 'Am Eingang?',
      }),
    );
    threadId = opened.body.thread.id;
    // Approved first, and that order is not a detail: a thread is visible once
    // a post in it is published (F195), so before the approval the second
    // account cannot even see the thread to reply in it.
    await api(
      `/api/admin/plugins/${PLUGIN}/posts/${opened.body.post.id}/approval`,
      { method: 'POST', headers: { cookie: admin } },
    );

    const reply = await api<Post>(
      `/api/participant/plugins/${PLUGIN}/threads/${threadId}/posts`,
      asParticipantJson(friend, { body: 'Ich bin am Eingang.' }),
    );
    replyId = reply.body.id;
    await api(`/api/admin/plugins/${PLUGIN}/posts/${replyId}/approval`, {
      method: 'POST',
      headers: { cookie: admin },
    });
  });

  afterAll(async () => {
    await toggle(PLUGIN, false);
    await deleteSeries(series.id);
    await deleteProfiles(DOMAIN);
    await closeDatabase();
  });

  describe('the export', () => {
    it('answers an archive that a reader opens, with the data and a readme', async () => {
      const archive = await exportArchive(owner);

      expect(archive.status).toBe(200);
      expect(archive.type).toContain('application/zip');
      expect(archive.disposition).toContain('trefaro-export-');

      const files = unpack(archive.bytes);
      expect(Object.keys(files).sort()).toEqual([
        'README.txt',
        'export.json',
        'profile-picture.png',
      ]);
    });

    it('leaves nothing out that is stored about this person', async () => {
      const files = unpack((await exportArchive(owner)).bytes);
      const payload = JSON.parse(files['export.json']) as ExportPayload;

      expect(payload.account).toMatchObject({
        id: ownerId,
        email: ownerEmail,
        firstName: 'Amina',
      });
      // The registration is found by address and nothing else (E31).
      expect(payload.registrations).toHaveLength(1);
      expect(payload.registrations[0].email.toLowerCase()).toBe(
        ownerEmail.toLowerCase(),
      );
      // Both halves of the conversation, because half of one is not one.
      const conversation = payload.conversations.find(
        (one) => one.id === conversationId,
      );
      expect(conversation?.messages.map((one) => one.mine)).toEqual([
        true,
        false,
      ]);
      expect(conversation?.messages[1].body).toBe('Ja, bis Samstag.');
      // The picture is in the archive and named in the JSON, so a reader can
      // tell which file belongs to what.
      expect(payload.account.profilePicture).toBe('profile-picture.png');
      // A browser is in here, the credential it holds is not.
      expect(payload.sessions.length).toBeGreaterThan(0);
      expect(files['export.json']).not.toContain('tokenHash');
      expect(files['export.json']).not.toContain(PASSWORD);
    });

    it('writes its sentences in the language this account reads', async () => {
      const files = unpack((await exportArchive(owner)).bytes);

      // German was chosen at registration; the readme is the one piece of
      // prose an archive holds, and it comes from the catalogue (E22).
      expect(files['README.txt']).toContain('Deine Daten');
      expect(files['export.json']).not.toContain('Deine Daten');
    });

    it('is not something a stranger can ask for', async () => {
      const anonymous = await fetch(`${BASE_URL}/api/participant/me/export`);

      expect(anonymous.status).toBe(401);
    });
  });

  describe('the erasure', () => {
    it('refuses a wrong password and leaves the account standing', async () => {
      const refused = await eraseWith(owner, 'not-the-passphrase');

      expect(refused.status).toBe(401);
      expect(await profileExists(ownerId)).toBe(true);
    });

    it('deletes the account, its sessions, its registrations and its seat', async () => {
      const gone = await eraseWith(owner, PASSWORD);

      expect(gone.status).toBe(204);
      expect(await profileExists(ownerId)).toBe(false);
      expect(await sessionCount(ownerId)).toBe(0);
      expect(await registrationCount(ownerEmail)).toBe(0);
      expect(await conversationMemberCount(ownerId)).toBe(0);
      // The session it was asked with is gone too, which is what makes this
      // one request rather than a request and a logout.
      expect(
        (await api('/api/participant/me', asParticipant(owner))).status,
      ).toBe(401);
    });

    it('leaves the conversation readable, and it names nobody', async () => {
      const conversation = await api<Conversation>(
        `/api/participant/conversations/${conversationId}`,
        asParticipant(friend),
      );
      const history = await api<Page<Message>>(
        `/api/participant/conversations/${conversationId}/messages`,
        asParticipant(friend),
      );

      expect(conversation.status).toBe(200);
      // Nobody left to name: the membership is gone, the words are not.
      expect(conversation.body.counterparts).toEqual([]);
      expect(history.body.rows.map((row) => row.body)).toEqual(
        expect.arrayContaining(['Kommst du auch?', 'Ja, bis Samstag.']),
      );
      expect(await messageCount(conversationId)).toBe(2);
    });

    it('leaves the thread standing with the reply of somebody else in it', async () => {
      const posts = await api<PostPage>(
        `/api/participant/plugins/${PLUGIN}/threads/${threadId}/posts`,
        asParticipant(friend),
      );

      expect(posts.status).toBe(200);
      expect(posts.body.thread.author).toBeNull();
      expect(posts.body.rows.some((row) => row.id === replyId)).toBe(true);
      // The foreign key of the plug-in decided this, not a statement of the
      // core: the row is there and its opener is empty.
      expect(await threadOpener(threadId)).toBeNull();
    });

    it('takes the conversation once nobody is left in it', async () => {
      // Both sides erased: what is left is two people's messages behind a row
      // that nothing can open any more. It goes, and what it held with it.
      const gone = await eraseWith(friend, PASSWORD);

      expect(gone.status).toBe(204);
      expect(await conversationMemberCount(friendId)).toBe(0);
      expect(await messageCount(conversationId)).toBe(0);
    });
  });
});
