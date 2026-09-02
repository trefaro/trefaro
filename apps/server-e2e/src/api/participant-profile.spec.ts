import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { adminCookie, cookieFrom } from '../support/admin-session';
import { api, postJson } from '../support/api-client';
import {
  closeDatabase,
  deleteProfileFields,
  deleteProfiles,
} from '../support/database';
import {
  accountConfirmationTokenFrom,
  clearMailbox,
  waitForMailTo,
  waitForMailpit,
} from '../support/mailpit';

/**
 * Contract of the profile itself (FR 4.3 — E35, E36, E37, F124).
 *
 * The acceptance criterion of AP 2, and most of it is only decidable through a
 * request:
 *
 * 1. Does a profile carry every field FR 4.3 names — name, picture, language,
 *    field of activity, the configurable answers — and is the address the one
 *    thing it cannot change (E31)?
 * 2. Is an unknown field key a 400 rather than a silent drop?
 * 3. Does a **removed** question keep the answers already given (F34)?
 * 4. Is a picture whose first bytes disagree with its type refused (F38), and is
 *    the stored path unreachable through the route that serves it (E9, F124)?
 * 5. Does `/api/media/profiles/:id/avatar` serve the image with no session at
 *    all — and does the profile's own `avatarUrl` carry no stored path?
 * 6. Does a password change end the other sessions of the same account?
 *
 * The last one is not in the plan for this work package. It is asserted because
 * the feature would be half a measure without it: somebody who changes their
 * password because a device is not theirs any more has said something about that
 * device too.
 */
interface Account {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  preferredLocale: string;
  avatarUrl: string | null;
  activityAreas: string | null;
  customFields: Record<string, string | boolean>;
  searchable: boolean;
  confirmedAt: string;
}

interface SessionInfo {
  participant: Account;
  expiresAt: string;
}

interface Avatar {
  avatarUrl: string | null;
}

interface Field {
  id: string;
  key: string;
}

const USER_SESSION_COOKIE = 'trefaro_user_session';
const BASE_URL = `http://127.0.0.1:${process.env['SERVER_PORT'] ?? '3000'}`;

/** The same directory the server writes to; see `UPLOAD_DIR` in `.env`. */
const UPLOAD_DIR = resolve(
  __dirname,
  '../../../..',
  process.env['UPLOAD_DIR'] ?? './tmp/uploads',
);

/** Unique per run, so a leftover row cannot make the next run take a wrong branch. */
const stamp = Date.now();
const DOMAIN = '@profile.example.org';
const KEY_PREFIX = `profile-contract-${stamp}`;
const PASSWORD = 'a-long-enough-passphrase';

/** Real headers, so the server's signature check decides as in production. */
const png = (padding = 64): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(padding, 0x2a),
  ]);

/** A zip archive's local file header — a `.zip` and a `.docx` start with it. */
const zip = (): Buffer =>
  Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);

/** Every file in the avatar subtree — an empty list if it does not exist. */
async function allAvatarFiles(): Promise<string[]> {
  try {
    return await readdir(resolve(UPLOAD_DIR, 'avatars'));
  } catch {
    return [];
  }
}

describe('the participant profile API', () => {
  let cookie = '';
  let admin = '';
  let profileId = '';
  /** What the volume held before this suite ran — the counts are deltas. */
  let baseline: string[] = [];

  const avatarFiles = async (): Promise<string[]> =>
    (await allAvatarFiles()).filter((name) => !baseline.includes(name));

  const json = (body: unknown, session = cookie): RequestInit => ({
    headers: { 'content-type': 'application/json', cookie: session },
    body: JSON.stringify(body),
  });

  const patch = (body: unknown, session = cookie) =>
    api<Account>('/api/participant/me', {
      method: 'PATCH',
      ...json(body, session),
    });

  const me = (session = cookie) =>
    api<SessionInfo>('/api/participant/me', { headers: { cookie: session } });

  const defineField = (body: Record<string, unknown>) =>
    api<Field>('/api/admin/profile-fields', {
      method: 'POST',
      ...json(body, admin),
    });

  const uploadAvatar = (bytes: Buffer, mimeType: string, session = cookie) => {
    const body = new FormData();
    body.set('file', new Blob([new Uint8Array(bytes)], { type: mimeType }));
    return api<Avatar>('/api/participant/me/avatar', {
      method: 'PUT',
      headers: { cookie: session },
      body,
    });
  };

  /** The public route, deliberately without any session. */
  const fetchImage = async (url: string) => {
    const response = await fetch(`${BASE_URL}${url}`);
    return {
      status: response.status,
      headers: response.headers,
      bytes: Buffer.from(await response.arrayBuffer()),
    };
  };

  /** Registers, confirms and logs in — the only way to hold a session (E32). */
  const signUp = async (name: string): Promise<string> => {
    const email = `${name}-${stamp}${DOMAIN}`;
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
    profileId = login.body.participant.id;
    return cookieFrom(login.headers, USER_SESSION_COOKIE);
  };

  beforeAll(async () => {
    await waitForMailpit();
    admin = adminCookie();
    baseline = await allAvatarFiles();
    cookie = await signUp('editor');
    expect(cookie).not.toBe('');
  });

  afterAll(async () => {
    await deleteProfileFields(KEY_PREFIX);
    await deleteProfiles(DOMAIN);
    await closeDatabase();
  });

  describe('what a profile carries', () => {
    it('answers every field FR 4.3 names, and no password hash', async () => {
      const current = await me();

      expect(current.status).toBe(200);
      expect(current.body.participant).toMatchObject({
        firstName: 'Amina',
        lastName: 'Okonkwo',
        preferredLocale: 'de',
        avatarUrl: null,
        activityAreas: null,
        customFields: {},
        // Off until its owner says otherwise (E37) — the default is the point.
        searchable: false,
      });
      expect(JSON.stringify(current.body)).not.toContain(PASSWORD);
      expect(JSON.stringify(current.body)).not.toContain('passwordHash');
    });

    it('changes what the form sent and leaves the rest alone', async () => {
      const updated = await patch({
        lastName: 'Okoro',
        activityAreas: 'Citizens’ assemblies',
        searchable: true,
      });

      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({
        firstName: 'Amina',
        lastName: 'Okoro',
        activityAreas: 'Citizens’ assemblies',
        searchable: true,
      });
    });

    it('refuses to change the address at all (E31)', async () => {
      const attempt = await patch({ email: `someone-else${DOMAIN}` });

      // The validation pipe forbids the unknown property: the address is the
      // identity, and the registrations of this person are found by it.
      expect(attempt.status).toBe(400);
      expect((await me()).body.participant.email).toContain(DOMAIN);
    });

    it('is closed without a session, like everything under the prefix (E33)', async () => {
      expect((await api('/api/participant/me')).status).toBe(401);
      expect(
        (await api('/api/participant/me', { method: 'PATCH' })).status,
      ).toBe(401);
    });
  });

  describe('the configurable answers', () => {
    let fieldKey = '';

    beforeAll(async () => {
      const created = await defineField({
        label: `${KEY_PREFIX}-local-group`,
        type: 'select',
        options: ['Cologne', 'Nairobi'],
      });
      expect(created.status).toBe(201);
      fieldKey = created.body.key;
    });

    it('stores an answer the definitions allow', async () => {
      const updated = await patch({ customFields: { [fieldKey]: 'Cologne' } });

      expect(updated.status).toBe(200);
      expect(updated.body.customFields).toEqual({ [fieldKey]: 'Cologne' });
    });

    it('refuses an unknown key rather than dropping it', async () => {
      const updated = await patch({
        customFields: { [fieldKey]: 'Cologne', 'favourite-colour': 'red' },
      });

      expect(updated.status).toBe(400);
      // And nothing was written: the answer from before is still the answer.
      expect((await me()).body.participant.customFields).toEqual({
        [fieldKey]: 'Cologne',
      });
    });

    it('refuses a choice the definition does not offer', async () => {
      const updated = await patch({ customFields: { [fieldKey]: 'Bonn' } });

      expect(updated.status).toBe(400);
    });

    it('leaves the answers untouched when the form does not send them', async () => {
      const updated = await patch({ lastName: 'Okonkwo' });

      expect(updated.body.customFields).toEqual({ [fieldKey]: 'Cologne' });
    });

    it('keeps the answers of a question the organizer removed (F34)', async () => {
      const created = await defineField({
        label: `${KEY_PREFIX}-languages`,
        type: 'text',
      });
      await patch({
        customFields: {
          [fieldKey]: 'Cologne',
          [created.body.key]: 'Twi, Igbo',
        },
      });

      const removed = await api(
        `/api/admin/profile-fields/${created.body.id}`,
        { method: 'DELETE', headers: { cookie: admin } },
      );
      expect(removed.status).toBe(204);

      // What somebody wrote about themselves is theirs; the definition was only
      // the question. Nothing renders it any more, and it is still there.
      const current = await me();
      expect(current.body.participant.customFields).toMatchObject({
        [created.body.key]: 'Twi, Igbo',
      });
    });

    it('lists the questions to whoever has to fill them in', async () => {
      const fields = await api<{ key: string; type: string }[]>(
        '/api/participant/profile-fields',
        { headers: { cookie } },
      );

      expect(fields.status).toBe(200);
      expect(fields.body.some((field) => field.key === fieldKey)).toBe(true);
      // The definitions are not part of the startup answer: `GET me` costs no
      // query, and this is a second screen's worth of data.
      expect(Object.keys((await me()).body.participant)).not.toContain(
        'profileFields',
      );
    });
  });

  describe('the profile picture', () => {
    it('refuses a zip archive announced as a PNG, and writes nothing (F38)', async () => {
      const refused = await uploadAvatar(zip(), 'image/png');

      expect(refused.status).toBe(400);
      await expect(avatarFiles()).resolves.toEqual([]);
    });

    it('stores the picture and answers a URL with no stored path (F124)', async () => {
      const uploaded = await uploadAvatar(png(), 'image/png');

      expect(uploaded.status).toBe(200);
      expect(uploaded.body.avatarUrl).toMatch(
        new RegExp(`^/api/media/profiles/${profileId}/avatar\\?v=\\d+$`),
      );

      const stored = await avatarFiles();
      expect(stored).toHaveLength(1);
      // The one property that matters: the file's name is nowhere in the URL,
      // because the neighbours of a stored path are attachments (E9).
      expect(uploaded.body.avatarUrl).not.toContain(stored[0]);
    });

    it('serves it to a request with no session at all', async () => {
      const url = (await me()).body.participant.avatarUrl ?? '';
      expect(url).not.toBe('');

      const image = await fetchImage(url);

      expect(image.status).toBe(200);
      expect(image.headers.get('content-type')).toBe('image/png');
      expect(image.headers.get('x-content-type-options')).toBe('nosniff');
      expect(image.headers.get('cache-control')).toContain('immutable');
      expect(image.bytes.subarray(0, 8)).toEqual(png().subarray(0, 8));
    });

    it('changes the `?v=` on the next upload, so the caching stays honest', async () => {
      const before = (await me()).body.participant.avatarUrl ?? '';

      const again = await uploadAvatar(png(128), 'image/png');

      expect(again.body.avatarUrl).not.toBe(before);
      // The previous file is gone: one account, one picture.
      await expect(avatarFiles()).resolves.toHaveLength(1);
    });

    it('takes the picture away again, and the route goes with it', async () => {
      const url = (await me()).body.participant.avatarUrl ?? '';

      const removed = await api<Avatar>('/api/participant/me/avatar', {
        method: 'DELETE',
        headers: { cookie },
      });

      expect(removed.status).toBe(200);
      expect(removed.body.avatarUrl).toBeNull();
      await expect(avatarFiles()).resolves.toEqual([]);
      // The 404 says only "there is no picture" — never whether the account is
      // there (F115 applied to a person).
      expect((await fetchImage(url)).status).toBe(404);
    });

    it('answers 404 for an account that does not exist', async () => {
      const nowhere = await fetchImage(
        '/api/media/profiles/00000000-0000-4000-8000-000000000000/avatar',
      );

      expect(nowhere.status).toBe(404);
    });

    it('needs a session to upload one', async () => {
      const anonymous = await api('/api/participant/me/avatar', {
        method: 'PUT',
      });

      expect(anonymous.status).toBe(401);
    });
  });

  describe('changing the password', () => {
    it('refuses a wrong current password', async () => {
      const attempt = await api('/api/participant/me/password', {
        method: 'PUT',
        ...json({
          currentPassword: 'not-the-passphrase',
          newPassword: 'another-long-passphrase',
        }),
      });

      expect(attempt.status).toBe(401);
    });

    it('refuses a new password the policy rejects', async () => {
      const attempt = await api('/api/participant/me/password', {
        method: 'PUT',
        ...json({ currentPassword: PASSWORD, newPassword: 'short' }),
      });

      expect(attempt.status).toBe(400);
    });

    it('changes it, and ends the other sessions of the same account', async () => {
      const changer = await signUp('changer');
      const email = (await me(changer)).body.participant.email;
      // A second device for the same person.
      const other = cookieFrom(
        (
          await postJson('/api/participant/auth/login', {
            email,
            password: PASSWORD,
          })
        ).headers,
        USER_SESSION_COOKIE,
      );
      expect((await me(other)).status).toBe(200);

      const changed = await api('/api/participant/me/password', {
        method: 'PUT',
        ...json(
          { currentPassword: PASSWORD, newPassword: 'another-long-passphrase' },
          changer,
        ),
      });

      expect(changed.status).toBe(204);
      // The session that made the change survives; the other one does not.
      expect((await me(changer)).status).toBe(200);
      expect((await me(other)).status).toBe(401);

      const withOld = await postJson('/api/participant/auth/login', {
        email,
        password: PASSWORD,
      });
      expect(withOld.status).toBe(401);
      const withNew = await postJson('/api/participant/auth/login', {
        email,
        password: 'another-long-passphrase',
      });
      expect(withNew.status).toBe(200);
    });
  });
});
