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
 * Contract of the profile field kit (FR 4.3 — E35).
 *
 * The half of AP 2 that belongs to the organizer: the questions an instance
 * asks its community. What only a request can settle is asserted here rather
 * than in `profile-fields.service.spec` —
 *
 * 1. Are the questions **instance-wide**, i.e. is there one flat collection and
 *    no event in the path (E35)?
 * 2. Does the key survive a rewording, so answers stay attached (F35)?
 * 3. Is the order written as a whole, and is a partial list refused?
 * 4. Is the collection closed to a participant's cookie, not only to none at
 *    all (E34)?
 *
 * Every question it creates carries a key of its own, and they all go at the
 * end: the kit is instance-wide, so a leftover **required** question would make
 * every other suite's profile update fail.
 */
interface Field {
  id: string;
  key: string;
  label: string;
  type: string;
  helpText: string | null;
  options: string[];
  required: boolean;
  sort: number;
}

/** Unique per run, and the handle the cleanup deletes by. */
const stamp = Date.now();
const KEY_PREFIX = `contract-${stamp}`;
const ACCOUNT_DOMAIN = '@fields.example.org';
const label = (name: string): string => `${KEY_PREFIX}-${name}`;

describe('the profile field kit API', () => {
  let cookie = '';

  const json = (body: unknown): RequestInit => ({
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });

  const create = (body: Record<string, unknown>) =>
    api<Field>('/api/admin/profile-fields', { method: 'POST', ...json(body) });

  const all = async (): Promise<Field[]> =>
    (await api<Field[]>('/api/admin/profile-fields', { headers: { cookie } }))
      .body;

  beforeAll(() => {
    cookie = adminCookie();
  });

  afterAll(async () => {
    await deleteProfileFields(KEY_PREFIX);
    // The one account this suite creates, to prove that a participant's cookie
    // does not open the organizer's collection. Unique instance-wide (E31), so
    // the row has to go.
    await deleteProfiles(ACCOUNT_DOMAIN);
    await closeDatabase();
  });

  describe('defining a question', () => {
    it('lives in one flat collection, with no event in the path (E35)', async () => {
      const created = await create({
        label: label('local-group'),
        type: 'text',
      });

      expect(created.status).toBe(201);
      // No `eventId` anywhere in the answer: a profile belongs to the person.
      expect(created.body).not.toHaveProperty('eventId');
      expect(created.body.key).toBe(`${KEY_PREFIX}-local-group`);
    });

    it('numbers a key that is taken instead of refusing it', async () => {
      const again = await create({ label: label('local-group'), type: 'text' });

      expect(again.status).toBe(201);
      expect(again.body.key).toBe(`${KEY_PREFIX}-local-group-2`);
    });

    it('refuses a key the profile itself owns (F35)', async () => {
      const clash = await create({
        label: 'Anything',
        type: 'text',
        key: 'searchable',
      });

      expect(clash.status).toBe(409);
    });

    it('refuses a selection without choices, and choices on anything else', async () => {
      const empty = await create({ label: label('region'), type: 'select' });
      expect(empty.status).toBe(400);

      const surplus = await create({
        label: label('newsletter'),
        type: 'checkbox',
        options: ['yes'],
      });
      expect(surplus.status).toBe(400);
    });

    it('appends, so a form people are filling in does not shift under them', async () => {
      // The whole form, not this suite's share of it: `sort` counts every
      // question the instance asks, and an instance may already ask some.
      const before = await all();

      const added = await create({ label: label('appended'), type: 'text' });

      expect(added.body.sort).toBe(before.length);
      expect((await all()).at(-1)?.key).toBe(added.body.key);
    });
  });

  describe('changing a question', () => {
    it('rewords it without moving the key an answer sits under (F35)', async () => {
      const created = await create({ label: label('languages'), type: 'text' });

      const updated = await api<Field>(
        `/api/admin/profile-fields/${created.body.id}`,
        {
          method: 'PATCH',
          ...json({ label: 'Which languages do you speak?' }),
        },
      );

      expect(updated.status).toBe(200);
      expect(updated.body.label).toBe('Which languages do you speak?');
      // The key is what four hundred answers are filed under.
      expect(updated.body.key).toBe(created.body.key);
    });

    it('refuses to change the type, whatever is sent', async () => {
      const created = await create({
        label: label('type-change'),
        type: 'text',
      });

      const attempt = await api(
        `/api/admin/profile-fields/${created.body.id}`,
        {
          method: 'PATCH',
          ...json({ type: 'checkbox' }),
        },
      );

      // The validation pipe forbids the unknown property outright: a selection
      // turned into a checkbox would leave every answer given as an invalid
      // value of the new type.
      expect(attempt.status).toBe(400);
    });

    it('answers 404 for a question that is gone', async () => {
      const created = await create({ label: label('gone'), type: 'text' });
      const removed = await api(
        `/api/admin/profile-fields/${created.body.id}`,
        { method: 'DELETE', headers: { cookie } },
      );
      expect(removed.status).toBe(204);

      const again = await api(`/api/admin/profile-fields/${created.body.id}`, {
        method: 'PATCH',
        ...json({ label: 'Anything' }),
      });
      expect(again.status).toBe(404);
    });
  });

  describe('the order of the form', () => {
    it('is written as a whole, and a partial list is refused', async () => {
      const ids = (await all()).map((field) => field.id);

      const reversed = await api<Field[]>('/api/admin/profile-fields/order', {
        method: 'PUT',
        ...json({ ids: [...ids].reverse() }),
      });

      expect(reversed.status).toBe(200);
      expect(reversed.body.map((field) => field.id)).toEqual(
        [...ids].reverse(),
      );

      // Half the list would renumber some questions and leave the rest at
      // positions that no longer mean anything.
      const partial = await api('/api/admin/profile-fields/order', {
        method: 'PUT',
        ...json({ ids: ids.slice(0, 1) }),
      });
      expect(partial.status).toBe(400);

      // Put it back, so the suites that run after this one see what they left.
      await api('/api/admin/profile-fields/order', {
        method: 'PUT',
        ...json({ ids }),
      });
    });
  });

  describe('who may read and write the form', () => {
    it('is closed without a session', async () => {
      const anonymous = await api('/api/admin/profile-fields');

      expect(anonymous.status).toBe(401);
    });

    it('is closed to a participant, not only to nobody (E34)', async () => {
      await waitForMailpit();
      await clearMailbox();

      const email = `fieldkit-${stamp}${ACCOUNT_DOMAIN}`;
      const password = 'a-long-enough-passphrase';
      await postJson('/api/user/profiles', {
        email,
        password,
        firstName: 'Amina',
        lastName: 'Okonkwo',
      });
      await postJson('/api/user/profiles/confirm', {
        token: accountConfirmationTokenFrom(await waitForMailTo(email)),
      });
      const login = await postJson('/api/participant/auth/login', {
        email,
        password,
      });
      const participant = cookieFrom(login.headers, 'trefaro_user_session');
      expect(participant).not.toBe('');

      // The participant may read the questions — they fill the form in — but
      // the definitions are the organizer's, and no guard takes the other's
      // cookie (E34).
      const theirs = await api('/api/participant/profile-fields', {
        headers: { cookie: participant },
      });
      expect(theirs.status).toBe(200);

      const admin = await api('/api/admin/profile-fields', {
        headers: { cookie: participant },
      });
      expect(admin.status).toBe(401);
    });

    it('needs a session for the participant view of the form as well', async () => {
      const anonymous = await api('/api/participant/profile-fields');

      expect(anonymous.status).toBe(401);
    });
  });
});
