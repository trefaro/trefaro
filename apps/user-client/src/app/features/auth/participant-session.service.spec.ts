import { TestBed } from '@angular/core/testing';
import { AppConfigService, STARTUP_TIMEOUT_MS } from '@trefaro/shared-config';
import { ApiClient } from '@trefaro/shared-http';
import {
  PROFILES_MODULE_KEY,
  type ParticipantAccount,
  type ParticipantSessionInfo,
} from '@trefaro/shared-models';
import { Observable, of, throwError } from 'rxjs';
import {
  ParticipantSessionService,
  isParticipantProbe,
} from './participant-session.service';

const account: ParticipantAccount = {
  id: 'profile-1',
  email: 'amina@example.org',
  firstName: 'Amina',
  lastName: 'Okonkwo',
  preferredLocale: 'de',
  avatarUrl: null,
  activityAreas: null,
  customFields: {},
  searchable: false,
  confirmedAt: '2026-09-01T10:00:00.000Z',
};

const session: ParticipantSessionInfo = {
  participant: account,
  expiresAt: '2026-09-02T21:00:00.000Z',
};

interface FakeApi {
  get: (path: string) => Observable<unknown>;
  post: (path: string, body: unknown) => Observable<unknown>;
}

const HINT_KEY = 'trefaro.participant-session';

function serviceWith(
  api: Partial<FakeApi>,
  options: { accounts?: boolean; hinted?: boolean } = {},
): { session: ParticipantSessionService; asked: string[] } {
  // The hint this browser leaves behind after a login: without it the service
  // does not probe at all, because most visitors of this client never log in.
  if (options.hinted ?? true) localStorage.setItem(HINT_KEY, 'yes');
  else localStorage.removeItem(HINT_KEY);

  const asked: string[] = [];
  TestBed.configureTestingModule({
    providers: [
      { provide: STARTUP_TIMEOUT_MS, useValue: 5_000 },
      {
        provide: AppConfigService,
        useValue: {
          isModuleEnabled: (key: string) =>
            key === PROFILES_MODULE_KEY ? (options.accounts ?? true) : true,
        },
      },
      {
        provide: ApiClient,
        useValue: {
          get: (path: string) => {
            asked.push(path);
            return (api.get ?? (() => throwError(() => ({ status: 401 }))))(
              path,
            );
          },
          post: api.post ?? (() => throwError(() => ({ status: 401 }))),
        },
      },
    ],
  });
  return { session: TestBed.inject(ParticipantSessionService), asked };
}

describe('ParticipantSessionService', () => {
  afterEach(() => {
    localStorage.removeItem(HINT_KEY);
    TestBed.resetTestingModule();
  });

  it('starts logged out', () => {
    const { session: service } = serviceWith({});

    expect(service.isLoggedIn()).toBe(false);
    expect(service.participant()).toBeNull();
    expect(service.expiresAt()).toBeNull();
  });

  it('turns the cookie the browser already has into a session', async () => {
    const { session: service } = serviceWith({ get: () => of(session) });

    await expect(service.restore()).resolves.toBe(true);
    expect(service.participant()?.email).toBe('amina@example.org');
    expect(service.expiresAt()?.toISOString()).toBe(session.expiresAt);
  });

  it('reads a 401 at startup as "not logged in", not as a failure', async () => {
    const { session: service } = serviceWith({
      get: () => throwError(() => ({ status: 401 })),
    });

    await expect(service.restore()).resolves.toBe(false);
    expect(service.isLoggedIn()).toBe(false);
    // And stops asking: the cookie is gone or was never there.
    expect(localStorage.getItem(HINT_KEY)).toBeNull();
  });

  it('does not probe at all for a browser that has never logged in', async () => {
    const { session: service, asked } = serviceWith(
      { get: () => of(session) },
      { hinted: false },
    );

    await expect(service.restore()).resolves.toBe(false);
    // The point is the empty list: most visitors of this client never log in,
    // and a probe for all of them put a 401 in the console of every public
    // page load.
    expect(asked).toEqual([]);
  });

  it('leaves the hint behind after a login and takes it back on logout', async () => {
    const { session: service } = serviceWith(
      { post: () => of(session) },
      { hinted: false },
    );

    await service.logIn('amina@example.org', 'a long enough passphrase');
    expect(localStorage.getItem(HINT_KEY)).toBe('yes');

    await service.logOut();
    expect(localStorage.getItem(HINT_KEY)).toBeNull();
  });

  it('asks nothing at all while accounts are switched off (F53)', async () => {
    const { session: service, asked } = serviceWith(
      { get: () => of(session) },
      { accounts: false },
    );

    await expect(service.restore()).resolves.toBe(false);
    // Not "the request failed": there was no request. Every route below
    // `profiles` answers 404 on such an instance.
    expect(asked).toEqual([]);
    expect(service.accountsEnabled()).toBe(false);
  });

  it('holds the session after a login and drops it after a logout', async () => {
    const { session: service } = serviceWith({ post: () => of(session) });

    await service.logIn('amina@example.org', 'a long enough passphrase');
    expect(service.isLoggedIn()).toBe(true);

    await service.logOut();
    expect(service.isLoggedIn()).toBe(false);
  });

  it('is logged out even when the logout request fails', async () => {
    const { session: service } = serviceWith({
      post: (path: string) =>
        path.endsWith('login')
          ? of(session)
          : throwError(() => ({ status: 500 })),
    });
    await service.logIn('amina@example.org', 'a long enough passphrase');

    await expect(service.logOut()).rejects.toBeDefined();

    // Whatever the server said, this browser is done with the session.
    expect(service.isLoggedIn()).toBe(false);
  });

  it('takes the account the profile form saved without touching the deadline', async () => {
    const { session: service } = serviceWith({ get: () => of(session) });
    await service.restore();

    service.adopt({ ...account, firstName: 'Amina Chidi' });

    expect(service.participant()?.firstName).toBe('Amina Chidi');
    expect(service.expiresAt()?.toISOString()).toBe(session.expiresAt);
  });

  it('adopts nothing while nobody is logged in', () => {
    const { session: service } = serviceWith({});

    service.adopt(account);

    expect(service.participant()).toBeNull();
  });
});

describe('isParticipantProbe', () => {
  it.each([
    '/api/participant/me',
    '/api/participant/auth/login',
    // "The current password is not right", which the server has no other
    // status for — and which must not be blamed on the session.
    '/api/participant/me/password',
  ])('treats a 401 from %s as the answer to the question', (url) => {
    expect(isParticipantProbe(url)).toBe(true);
  });

  it('treats every other 401 as an expired session', () => {
    expect(isParticipantProbe('/api/participant/profile-fields')).toBe(false);
    // The prefix trap: `participant/me` must not exempt its own sub-routes.
    expect(isParticipantProbe('/api/participant/me/avatar')).toBe(false);
  });

  it('sees through a query string', () => {
    expect(isParticipantProbe('/api/participant/me?locale=de')).toBe(true);
  });
});
