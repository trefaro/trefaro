import { SETUP_TOKEN_HEADER } from '@trefaro/shared-models';
import { api, postJson } from '../support/api-client';

/**
 * Contract of the first-run setup (FR 1.1, E28).
 *
 * What can be checked here is the half that matters for an instance that is
 * *running*: the route is gone. This suite runs against an instance created from
 * `ADMIN_BOOTSTRAP_*`, so an administrator exists — and the last administrator
 * cannot be deleted by design (F22), which means no suite in this repository can
 * ever reach the state in which the setup exists.
 *
 * The other half is covered where it can be: the service, the guard and the page
 * have unit tests for the happy path, and
 * `tools/spike-verification/verify-setup.mjs` walks the real endpoints against a
 * genuinely fresh stack. That split is deliberate — a test that could reach this
 * state would have to be able to remove every administrator from a running
 * instance, which is precisely what nothing may be able to do.
 */
const SUBMISSION = {
  admin: {
    email: 'intruder@example.org',
    name: 'Intruder',
    password: 'a-long-enough-passphrase',
  },
  organizationName: 'Not This Organization',
  defaultLocale: 'en',
  primaryColor: '#000000',
  accentColor: '#ffffff',
};

function withToken(token: string): RequestInit {
  return { headers: { [SETUP_TOKEN_HEADER]: token } };
}

describe('first-run setup', () => {
  it('does not exist on an instance that has an administrator', async () => {
    const response = await api('/api/setup/state');

    // 404, not 401: the setup is over, not locked. An operator reading this
    // answer should look for the login form, not for a token.
    expect(response.status).toBe(404);
  });

  it('answers 404 with a token as well, so a leaked token expires with use', async () => {
    // Whatever token this instance printed when it was fresh is worth nothing
    // now — the condition is the administrator, not the secret.
    const response = await api(
      '/api/setup/state',
      withToken('any-token-at-all'),
    );

    expect(response.status).toBe(404);
  });

  it('refuses to create a second first administrator', async () => {
    const response = await api('/api/setup/admin', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [SETUP_TOKEN_HEADER]: 'any-token-at-all',
      },
      body: JSON.stringify(SUBMISSION),
    });

    expect(response.status).toBe(404);
  });

  it('is not reachable under the administrative prefix either', async () => {
    // The route sits at `/api/setup` on purpose: the administrative guard hangs
    // on the `/api/admin` prefix (E16) and would demand the session this route
    // exists to make possible. What must not happen is a second address for it
    // that the guard *does* cover — a 401 here would mean the guard is all that
    // stands in front of a first-administrator endpoint.
    for (const path of ['/api/admin/setup/state', '/api/admin/setup/admin']) {
      const response = await api(path);
      expect(response.status).toBe(404);
    }
  });

  it('leaves the organization name and colours alone', async () => {
    // The submission above tried to write both. `/api/config` is public, so this
    // is the cheapest possible proof that nothing behind the closed route ran.
    const response = await api<{
      organizationName: string;
      theme: { primaryColor: string };
    }>('/api/config');

    expect(response.status).toBe(200);
    expect(response.body.organizationName).not.toBe('Not This Organization');
    expect(response.body.theme.primaryColor).not.toBe('#000000');
  });

  it('does not offer a login to the account the submission tried to create', async () => {
    const response = await postJson('/api/admin/auth/login', {
      email: SUBMISSION.admin.email,
      password: SUBMISSION.admin.password,
    });

    expect(response.status).toBe(401);
  });
});
