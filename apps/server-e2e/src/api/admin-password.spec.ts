import { api, postJson } from '../support/api-client';
import { adminCookie, cookieFrom } from '../support/admin-session';

/**
 * Changing one's own organizer password (AP 9 of phase 5, FR 1.2).
 *
 * The finding the security review opened with, on the wire: an organizer's
 * password used to be whatever it had been when the account was created, with
 * no way to change it.
 *
 * It works on a **throwaway account** and never on the bootstrap one, and that
 * is not tidiness: every other suite in this run signs in with the bootstrap
 * credentials out of `.env`, so a suite that changed them would take the whole
 * contract run with it. The account is created through the API and deleted
 * again at the end, through the session the global setup established.
 *
 * Four logins, against the 300 of `apps/server/.env.serve-e2e` (E61): two to
 * hold two sessions of the same account at once — which is what the "other
 * sessions end" half needs — and two to show that the old password stops
 * working and the new one starts.
 */
const ADDRESS = 'rotating-organizer@example.org';
const OLD_PASSWORD = 'the-first-one-was-long';
const NEW_PASSWORD = 'and-the-second-one-too';

async function signIn(password: string) {
  return postJson('/api/admin/auth/login', { email: ADDRESS, password });
}

/** Whether a cookie still opens an administrative door. */
async function stillWorks(cookie: string): Promise<boolean> {
  const { status } = await api('/api/admin/admins', {
    headers: { cookie },
  });
  return status === 200;
}

function changePassword(cookie: string, body: unknown) {
  return api('/api/admin/me/password', {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/admin/me/password', () => {
  /** The session that stays: the one the change is made from. */
  let mine = '';
  /** A second session of the same account, on another device. */
  let elsewhere = '';
  let createdId = '';

  beforeAll(async () => {
    // A run that died halfway leaves the account behind, and creating it again
    // would answer 409 — so the suite starts by clearing its own leftovers
    // rather than by needing a fresh database.
    const existing = await api<{ id: string; email: string }[]>(
      '/api/admin/admins',
      { headers: { cookie: adminCookie() } },
    );
    for (const account of existing.body) {
      if (account.email.toLowerCase() !== ADDRESS) continue;
      await api(`/api/admin/admins/${account.id}`, {
        method: 'DELETE',
        headers: { cookie: adminCookie() },
      });
    }

    const created = await api<{ id: string }>('/api/admin/admins', {
      method: 'POST',
      headers: { cookie: adminCookie(), 'content-type': 'application/json' },
      body: JSON.stringify({
        email: ADDRESS,
        name: 'Rotating Organizer',
        password: OLD_PASSWORD,
      }),
    });
    expect(created.status).toBe(201);
    createdId = created.body.id;

    mine = cookieFrom((await signIn(OLD_PASSWORD)).headers);
    elsewhere = cookieFrom((await signIn(OLD_PASSWORD)).headers);
    expect(mine).not.toBe('');
    expect(elsewhere).not.toBe('');
  });

  afterAll(async () => {
    if (!createdId) return;
    await api(`/api/admin/admins/${createdId}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie() },
    });
  });

  it('refuses a wrong current password without touching the session', async () => {
    const { status } = await changePassword(mine, {
      currentPassword: 'not-the-one',
      newPassword: NEW_PASSWORD,
    });

    expect(status).toBe(401);
    // The 401 is about the password in the body, not about the cookie — a
    // client that read it as an expiry would sign somebody out over a typo.
    await expect(stillWorks(mine)).resolves.toBe(true);
  });

  it('refuses a new password the policy does not allow', async () => {
    const { status } = await changePassword(mine, {
      currentPassword: OLD_PASSWORD,
      newPassword: 'short',
    });

    expect(status).toBe(400);
  });

  it('needs a session at all', async () => {
    const { status } = await api('/api/admin/me/password', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword: OLD_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    });

    expect(status).toBe(401);
  });

  it('changes it, keeps this session and ends the other one', async () => {
    const { status } = await changePassword(mine, {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(status).toBe(204);
    await expect(stillWorks(mine)).resolves.toBe(true);
    // The half that makes the feature protective rather than cosmetic.
    await expect(stillWorks(elsewhere)).resolves.toBe(false);
  });

  it('leaves the old password refused and the new one accepted', async () => {
    await expect(signIn(OLD_PASSWORD)).resolves.toMatchObject({ status: 401 });
    await expect(signIn(NEW_PASSWORD)).resolves.toMatchObject({ status: 200 });
  });
});
