import { api, postJson } from '../support/api-client';
import {
  closeDatabase,
  deleteProfiles,
  seedSession,
} from '../support/database';
import {
  accountConfirmationTokenFrom,
  clearMailbox,
  countMailTo,
  passwordResetTokenFrom,
  waitForMailTo,
  waitForMailpit,
} from '../support/mailpit';

/**
 * Contract of the forgotten-password routes (AP 4 of phase 5, E10, E32, F139).
 *
 * The one dead end a participant could walk into, and the suite is shaped by
 * the rule that makes it awkward: an unauthenticated caller must not be able to
 * learn from an answer whether an address has an account here. So the
 * interesting assertions are about **sameness** — same status, same body, a
 * letter either way — and the differences are read where they are allowed to
 * exist, in Mailpit.
 *
 * The link itself is taken out of the message the server really sent, like
 * every other token in these suites: a reset that is only asserted inside the
 * service has not been shown to work.
 */
interface SessionInfo {
  participant: { id: string };
}

const USER_SESSION_COOKIE = 'trefaro_user_session';

/** Unique per run, so a leftover row cannot make the next run take a wrong branch. */
const stamp = Date.now();
const DOMAIN = '@reset.example.org';
const address = (name: string): string => `${name}-${stamp}${DOMAIN}`;

const PASSWORD = 'a-long-enough-passphrase';
const NEW_PASSWORD = 'an even longer passphrase';

const RESET_PATH = '/api/user/profiles/password-reset';
const SET_PATH = '/api/user/profiles/password';

const registration = (email: string) => ({
  email,
  password: PASSWORD,
  firstName: 'Amina',
  lastName: 'Okonkwo',
  preferredLocale: 'en',
});

/** A confirmed account, the way a person makes one: form, mail, link. */
async function accountFor(email: string): Promise<void> {
  await postJson('/api/user/profiles', registration(email));
  const mail = await waitForMailTo(email);
  const confirmed = await postJson('/api/user/profiles/confirm', {
    token: accountConfirmationTokenFrom(mail),
  });
  expect(confirmed.status).toBe(200);
}

/** The token out of the letter the server sent to this address. */
async function resetTokenFor(email: string): Promise<string> {
  const asked = await postJson<{ email: string }>(RESET_PATH, { email });
  expect(asked.status).toBe(200);
  return passwordResetTokenFrom(await waitForMailTo(email));
}

const logIn = (email: string, password: string) =>
  postJson<SessionInfo>('/api/participant/auth/login', { email, password });

describe('forgotten password API', () => {
  beforeAll(async () => {
    await waitForMailpit();
  });

  afterAll(async () => {
    // Unique instance-wide (E31), so the rows have to go; sessions cascade.
    await deleteProfiles(DOMAIN);
    await closeDatabase();
  });

  describe('asking for a link', () => {
    it('mails one to a confirmed address, and the link sets the password', async () => {
      const email = address('returning');
      await accountFor(email);
      await clearMailbox();

      const token = await resetTokenFor(email);
      const set = await api(SET_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password: NEW_PASSWORD }),
      });

      expect(set.status).toBe(204);
      // Both directions: the new password works and the old one has stopped.
      expect((await logIn(email, NEW_PASSWORD)).status).toBe(200);
      expect((await logIn(email, PASSWORD)).status).toBe(401);
    });

    it('answers an unknown address exactly as a known one, and writes to it too', async () => {
      const known = address('known');
      const unknown = address('stranger');
      await accountFor(known);
      await clearMailbox();

      const forKnown = await postJson<{ email: string }>(RESET_PATH, {
        email: known,
      });
      const forUnknown = await postJson<{ email: string }>(RESET_PATH, {
        email: unknown,
      });

      expect(forUnknown.status).toBe(forKnown.status);
      expect(forUnknown.body).toEqual({ email: unknown });
      expect(forKnown.body).toEqual({ email: known });

      // The half a status code cannot give: both addresses are written to, so
      // the request costs the same mail server conversation either way — which
      // is what makes the *duration* of the answer say nothing either. The
      // letters differ, and only their inboxes read them.
      const strangersLetter = await waitForMailTo(unknown);
      expect(strangersLetter.text).not.toContain('token=');
      expect(passwordResetTokenFrom(await waitForMailTo(known))).toBeTruthy();
    });

    it('takes no longer for a known address than for an unknown one', async () => {
      const known = address('timed');
      const unknown = address('timed-stranger');
      await accountFor(known);

      // Three each and the median, because one measurement on a busy machine
      // measures the machine. The tolerance is deliberately generous: what this
      // asserts is that neither path skips a whole step the other takes, not
      // that a mail server answers in constant time.
      const median = async (email: string): Promise<number> => {
        const runs: number[] = [];
        for (let attempt = 0; attempt < 3; attempt++) {
          const started = Date.now();
          expect((await postJson(RESET_PATH, { email })).status).toBe(200);
          runs.push(Date.now() - started);
        }
        return runs.sort((a, b) => a - b)[1];
      };

      const forKnown = await median(known);
      const forUnknown = await median(unknown);

      expect(forKnown).toBeLessThan(forUnknown * 4 + 250);
      expect(forUnknown).toBeLessThan(forKnown * 4 + 250);
    });

    it('sends the confirmation again while the address is unconfirmed', async () => {
      const email = address('halfway');
      await postJson('/api/user/profiles', registration(email));
      await clearMailbox();

      await postJson(RESET_PATH, { email });

      // The mail that fits the state the address is in: a reset link would hand
      // over an account whose address nobody has proved they hold.
      const mail = await waitForMailTo(email);
      expect(mail.text).toContain('profile/confirm?token=');
      expect(mail.text).not.toContain('new-password');
    });

    it('refuses something that is not an address, and sends nothing', async () => {
      await clearMailbox();

      expect(
        (await postJson(RESET_PATH, { email: 'not-an-address' })).status,
      ).toBe(400);
      expect(await countMailTo('not-an-address')).toBe(0);
    });
  });

  describe('setting the password', () => {
    const set = (token: string, password: string) =>
      postJson(SET_PATH, { token, password });

    it('spends the link — the same token a second time is refused', async () => {
      const email = address('twice');
      await accountFor(email);
      await clearMailbox();
      const token = await resetTokenFor(email);

      expect((await set(token, NEW_PASSWORD)).status).toBe(204);
      // Nothing is stored to say the link was used: the token was minted
      // against the password it has just replaced, so it no longer resolves.
      expect((await set(token, 'a third long passphrase')).status).toBe(400);
      expect((await logIn(email, NEW_PASSWORD)).status).toBe(200);
    });

    it('ends every session of the account (F139)', async () => {
      const email = address('everywhere');
      await accountFor(email);
      await clearMailbox();
      const token = await resetTokenFor(email);

      const { body } = await logIn(email, PASSWORD);
      const elsewhere = await seedSession(body.participant.id);
      const cookie = `${USER_SESSION_COOKIE}=${elsewhere}`;
      expect(
        (await api('/api/participant/me', { headers: { cookie } })).status,
      ).toBe(200);

      expect((await set(token, NEW_PASSWORD)).status).toBe(204);

      // Not "all but the current one": whoever asks for a reset is holding no
      // session, and the ones that exist may not be theirs.
      expect(
        (await api('/api/participant/me', { headers: { cookie } })).status,
      ).toBe(401);
    });

    it('refuses a forged token and a spelled-out account id alike', async () => {
      const email = address('forged');
      await accountFor(email);
      await clearMailbox();
      const token = await resetTokenFor(email);
      const [payload, signature] = token.split('.');

      for (const forged of [
        'nonsense',
        `${payload}.${signature}x`,
        `${payload}x.${signature}`,
      ]) {
        expect((await set(forged, NEW_PASSWORD)).status).toBe(400);
      }
      // And the password is untouched by all of that.
      expect((await logIn(email, PASSWORD)).status).toBe(200);
    });

    it('refuses a password the policy rejects', async () => {
      const email = address('tooshort');
      await accountFor(email);
      await clearMailbox();
      const token = await resetTokenFor(email);

      expect((await set(token, 'short')).status).toBe(400);
      // The link is not spent by a refusal — the password never changed.
      expect((await set(token, NEW_PASSWORD)).status).toBe(204);
    });
  });
});
