import { PROBLEM_CODES } from '@trefaro/shared-models';
import { adminCookie } from '../support/admin-session';
import { api, postJson, refusalOf } from '../support/api-client';

/**
 * How a refusal travels (E64) — AP 5 of phase 5.
 *
 * Until this package the business layer answered in English sentences, and F77
 * settled for showing them beside the client's own: the *what* in the reader's
 * language, the *why* in English. This suite asserts the other half of the fix.
 *
 * Three claims, and they are the ones a unit test cannot make:
 *
 * 1. **A refused request carries a code and its values**, through the exception
 *    filter and onto the wire — the one place a unit test of a service cannot
 *    reach, because the filter rewrites the body.
 * 2. **The code is one the catalogue has a sentence for.** A code the build
 *    does not know would reach a screen as its own key.
 * 3. **The suite asserts the code and not the sentence**, which is the second
 *    argument for codes: prose changes without meaning changing, and a suite
 *    matching on prose is a suite that is edited for the wrong reasons.
 *
 * A handful of refusals rather than all of them: every module's own suite holds
 * its own cases, and this one is about the shape they all share.
 */
const KNOWN: ReadonlySet<string> = new Set(PROBLEM_CODES);

const stamp = Date.now();

interface Series {
  id: string;
  slug: string;
}

describe('a refused request', () => {
  let cookie: string;
  let series: Series;

  const asAdminJson = (method: string, payload: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });

  beforeAll(async () => {
    cookie = adminCookie();
    series = (
      await api<Series>(
        '/api/admin/series',
        asAdminJson('POST', {
          name: `Problem Codes Contract Series ${stamp}`,
          description: 'Holds the refusals this suite provokes.',
          status: 'published',
        }),
      )
    ).body;
  });

  it('answers a bad request with a code the catalogue knows, and no sentence', async () => {
    const refused = await postJson('/api/user/profiles/password', {
      token: 'not.a.token',
      password: 'a-long-enough-password',
    });

    expect(refused.status).toBe(400);
    expect(refusalOf(refused.body)).toEqual({
      code: 'problem.profile.resetLinkStale',
      params: {},
    });
    // And nothing in the body is a sentence somebody has to read in English:
    // `message` carries the same code, which is what a log line prints.
    expect((refused.body as { message?: unknown }).message).toBe(
      'problem.profile.resetLinkStale',
    );
  });

  it('carries the values the sentence has gaps for', async () => {
    const refused = await api(`/api/user/series/${series.slug}?locale=%40%40`);

    expect(refused.status).toBe(400);
    expect(refusalOf(refused.body)).toEqual({
      code: 'problem.locale.tag',
      params: { field: 'locale' },
    });
  });

  it('answers a conflict with a code too, not only a status', async () => {
    // A registration field under a key the core registration already owns: the
    // request is well formed and refused by the state of the instance (F35).
    const event = await api<{ id: string }>(
      `/api/admin/series/${series.id}/events`,
      asAdminJson('POST', {
        name: `Problem Codes Contract Event ${stamp}`,
        description: 'Carries the registration form this suite collides with.',
        eventType: 'onsite',
        venueName: 'Bürgerhaus',
        startsAt: '2099-06-14T08:00:00.000Z',
        endsAt: '2099-06-14T16:00:00.000Z',
        timezone: 'Europe/Berlin',
        languages: ['de'],
        status: 'draft',
      }),
    );
    expect(event.status).toBe(201);

    const refused = await api(
      `/api/admin/events/${event.body.id}/registration-fields`,
      asAdminJson('POST', {
        label: 'Your e-mail address',
        key: 'email',
        type: 'text',
      }),
    );

    expect(refused.status).toBe(409);
    expect(refusalOf(refused.body)).toEqual({
      code: 'problem.field.keyReservedByRegistration',
      params: { key: 'email' },
    });
  });

  it('gives a code this build has a sentence for, whichever refusal it is', async () => {
    // Four refusals from four modules, to show the rule is the filter's and not
    // one service's habit.
    const refusals = await Promise.all([
      postJson('/api/user/registrations/confirm', { token: 'nope' }),
      postJson('/api/user/profiles/password', {
        token: 'nope',
        password: 'a-long-enough-password',
      }),
      api('/api/user/registrations/me'),
      api(`/api/user/series/${series.slug}?locale=%23%23`),
    ]);

    for (const refused of refusals) {
      const refusal = refusalOf(refused.body);
      expect(`${refused.status} ${JSON.stringify(refused.body)}`).toMatch(
        /^4\d\d/,
      );
      expect(refusal).not.toBeNull();
      expect(KNOWN.has(refusal?.code ?? '')).toBe(true);
    }
  });

  it('says nothing beyond its status where the client already knows why', async () => {
    // A 404 carries no code: the client's own sentence says "not found" better
    // than a repetition of the status would, and there is nothing to translate.
    const missing = await api('/api/user/series/no-such-series-at-all');

    expect(missing.status).toBe(404);
    expect(refusalOf(missing.body)).toBeNull();
  });
});
