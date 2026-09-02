import { api, postJson } from '../support/api-client';
import { cookieFrom } from '../support/admin-session';
import { deleteProfiles } from '../support/database';
import {
  accountConfirmationTokenFrom,
  clearMailbox,
  countMailTo,
  waitForMailTo,
  waitForMailpit,
} from '../support/mailpit';

/**
 * Contract of the participant account endpoints (FR 4.1, FR 4.2 — E31–E34).
 *
 * This is the suite that proves the acceptance criterion of AP 1 end to end: a
 * registration produces a mail, the link in that mail confirms the address, a
 * login before the confirmation fails, a login after it succeeds,
 * `/api/participant/**` is closed without the cookie, `/api/user/**` is not, and
 * a second registration on the same address answers exactly like the first.
 *
 * The mail is read out of Mailpit rather than mocked away — a double opt-in that
 * is only asserted at the mailer interface has not been tested where it matters.
 */
interface SessionInfo {
  participant: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    preferredLocale: string;
    confirmedAt: string;
  };
  expiresAt: string;
}

/** The cookie under test — deliberately not the administrative one (E34). */
const USER_SESSION_COOKIE = 'trefaro_user_session';

/** Unique per run, so a leftover row cannot make the next run take a wrong branch. */
const stamp = Date.now();
const DOMAIN = '@accounts.example.org';
const address = (name: string): string => `${name}-${stamp}${DOMAIN}`;

const PASSWORD = 'a-long-enough-passphrase';

const registration = (email: string, extra: Record<string, unknown> = {}) => ({
  email,
  password: PASSWORD,
  firstName: 'Amina',
  lastName: 'Okonkwo',
  preferredLocale: 'de',
  ...extra,
});

describe('participant accounts API', () => {
  beforeAll(async () => {
    await waitForMailpit();
  });

  afterAll(async () => {
    // Unique instance-wide (E31), so the rows have to go — there is no endpoint
    // that could remove them, by design.
    await deleteProfiles(DOMAIN);
  });

  describe('creating an account', () => {
    it('answers with the address and mails a confirmation link', async () => {
      const email = address('newcomer');
      await clearMailbox();

      const created = await postJson<{ email: string }>(
        '/api/user/profiles',
        registration(email),
      );

      expect(created.status).toBe(200);
      expect(created.body).toEqual({ email });

      const mail = await waitForMailTo(email);
      // The link points at a page in the participant client, not at the API
      // (E5b) — this throws if it does not.
      expect(accountConfirmationTokenFrom(mail)).toBeTruthy();
      // And it carries no session: nothing is granted before the confirmation.
      expect(mail.text).not.toContain('token=undefined');
    });

    it('refuses a password the policy rejects, and sends nothing', async () => {
      const email = address('shortpass');
      await clearMailbox();

      const created = await postJson(
        '/api/user/profiles',
        registration(email, { password: 'short' }),
      );

      expect(created.status).toBe(400);
      await expect(countMailTo(email)).resolves.toBe(0);
    });

    it('is reachable without any session — this is a public form', async () => {
      const anonymous = await api('/api/user/profiles', { method: 'POST' });

      // 400 for the empty body, not 401: the endpoint itself is open.
      expect(anonymous.status).toBe(400);
    });
  });

  describe('confirming and logging in', () => {
    const email = address('confirmer');
    let token = '';

    it('mails a token that confirms exactly once (E5b)', async () => {
      await clearMailbox();
      await postJson('/api/user/profiles', registration(email));
      token = accountConfirmationTokenFrom(await waitForMailTo(email));

      const first = await postJson<{ state: string; firstName: string }>(
        '/api/user/profiles/confirm',
        { token },
      );
      expect(first.status).toBe(200);
      expect(first.body).toEqual({ state: 'confirmed', firstName: 'Amina' });

      // A second click reports what is already true instead of failing.
      const second = await postJson<{ state: string }>(
        '/api/user/profiles/confirm',
        { token },
      );
      expect(second.status).toBe(200);
      expect(second.body.state).toBe('already-confirmed');
    });

    it('refuses a forged token', async () => {
      const forged = await postJson('/api/user/profiles/confirm', {
        token: `${token}x`,
      });

      expect(forged.status).toBe(400);
    });

    it('logs in and hands out a cookie of its own (E34)', async () => {
      const login = await postJson<SessionInfo>('/api/participant/auth/login', {
        email,
        password: PASSWORD,
      });

      expect(login.status).toBe(200);
      expect(login.body.participant).toMatchObject({
        email,
        firstName: 'Amina',
        preferredLocale: 'de',
      });
      // Never the administrative cookie, and never the password back.
      expect(cookieFrom(login.headers, USER_SESSION_COOKIE)).not.toBe('');
      expect(cookieFrom(login.headers, 'trefaro_admin_session')).toBe('');
      expect(JSON.stringify(login.body)).not.toContain(PASSWORD);
    });

    it('says who is logged in, and closes the door again on logout', async () => {
      const login = await postJson<SessionInfo>('/api/participant/auth/login', {
        email,
        password: PASSWORD,
      });
      const cookie = cookieFrom(login.headers, USER_SESSION_COOKIE);

      const me = await api<SessionInfo>('/api/participant/me', {
        headers: { cookie },
      });
      expect(me.status).toBe(200);
      expect(me.body.participant.email).toBe(email);

      const logout = await api('/api/participant/auth/logout', {
        method: 'POST',
        headers: { cookie },
      });
      expect(logout.status).toBe(204);

      const after = await api('/api/participant/me', { headers: { cookie } });
      expect(after.status).toBe(401);
    });

    it('lets a logout without a session succeed — an expired one must not fail', async () => {
      const logout = await api('/api/participant/auth/logout', {
        method: 'POST',
      });

      expect(logout.status).toBe(204);
    });

    it('refuses a wrong password without saying whether the address is known', async () => {
      const known = await postJson<{ message: string }>(
        '/api/participant/auth/login',
        { email, password: 'not-the-right-passphrase' },
      );
      const unknown = await postJson<{ message: string }>(
        '/api/participant/auth/login',
        { email: address('nobody'), password: 'not-the-right-passphrase' },
      );

      expect(known.status).toBe(401);
      expect(unknown.status).toBe(401);
      // Everything the caller can read has to match. The error body also
      // carries a timestamp, which differs by a millisecond and says nothing.
      expect(known.body.message).toBe(unknown.body.message);
    });
  });

  describe('the guard on /api/participant', () => {
    it('closes every route below it without a cookie (E33)', async () => {
      const me = await api('/api/participant/me');

      expect(me.status).toBe(401);
    });

    it('ignores an administrative cookie: two cookies, two identities (E34)', async () => {
      const me = await api('/api/participant/me', {
        headers: { cookie: 'trefaro_admin_session=whatever-an-organizer-has' },
      });

      expect(me.status).toBe(401);
    });

    it('leaves the public prefix public — that is why there is a third one', async () => {
      const landing = await api('/api/user/series');
      const config = await api('/api/config');

      expect(landing.status).toBe(200);
      expect(config.status).toBe(200);
    });
  });

  describe('a second attempt on an address that already has an account', () => {
    it('answers exactly like the first, and changes nothing (E32)', async () => {
      const email = address('twice');
      await clearMailbox();

      const first = await postJson<{ email: string }>(
        '/api/user/profiles',
        registration(email),
      );
      const token = accountConfirmationTokenFrom(await waitForMailTo(email));
      await postJson('/api/user/profiles/confirm', { token });

      await clearMailbox();
      const second = await postJson<{ email: string }>(
        '/api/user/profiles',
        registration(email, {
          firstName: 'Somebody',
          password: 'a-completely-different-passphrase',
        }),
      );

      expect(second.status).toBe(first.status);
      expect(second.body).toEqual(first.body);

      // The difference is in the mail, which only its recipient reads: it tells
      // them an account exists and carries no token.
      const notice = await waitForMailTo(email);
      expect(() => accountConfirmationTokenFrom(notice)).toThrow();

      // And nothing was applied — neither the name nor the new password.
      const takeover = await postJson('/api/participant/auth/login', {
        email,
        password: 'a-completely-different-passphrase',
      });
      expect(takeover.status).toBe(401);

      const login = await postJson<SessionInfo>('/api/participant/auth/login', {
        email,
        password: PASSWORD,
      });
      expect(login.status).toBe(200);
      expect(login.body.participant.firstName).toBe('Amina');
    });
  });

  describe('logging in before the address is confirmed', () => {
    it('fails, and says why — a session before the opt-in would make it decorative (E32)', async () => {
      const email = address('impatient');
      await clearMailbox();
      await postJson('/api/user/profiles', registration(email));
      await waitForMailTo(email);

      const login = await postJson('/api/participant/auth/login', {
        email,
        password: PASSWORD,
      });

      // 403 rather than 401, and only because the password was right: somebody
      // who can produce it already knows the account exists, and telling them
      // nothing would leave them stuck.
      expect(login.status).toBe(403);
      expect(cookieFrom(login.headers, USER_SESSION_COOKIE)).toBe('');
    });
  });
});
