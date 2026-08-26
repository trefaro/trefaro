import { TestBed } from '@angular/core/testing';
import { STARTUP_TIMEOUT_MS } from '@trefaro/shared-config';
import { ApiClient } from '@trefaro/shared-http';
import type { AdminSessionInfo } from '@trefaro/shared-models';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { AuthService, isSessionProbe } from './auth.service';

const session: AdminSessionInfo = {
  admin: {
    id: 'admin-1',
    email: 'organizer@example.org',
    name: 'Alex Weber',
    createdAt: '2026-08-01T10:00:00.000Z',
    lastLoginAt: '2026-08-26T09:00:00.000Z',
  },
  expiresAt: '2026-08-26T21:00:00.000Z',
};

interface FakeApi {
  get: (path: string) => Observable<unknown>;
  post: (path: string, body: unknown) => Observable<unknown>;
}

function serviceWith(
  api: Partial<FakeApi>,
  startupTimeoutMs = 5_000,
): AuthService {
  TestBed.configureTestingModule({
    providers: [
      { provide: STARTUP_TIMEOUT_MS, useValue: startupTimeoutMs },
      {
        provide: ApiClient,
        useValue: {
          get: api.get ?? (() => throwError(() => ({ status: 401 }))),
          post: api.post ?? (() => throwError(() => ({ status: 401 }))),
        },
      },
    ],
  });
  return TestBed.inject(AuthService);
}

describe('AuthService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('starts logged out', () => {
    const auth = serviceWith({});

    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.admin()).toBeNull();
    expect(auth.expiresAt()).toBeNull();
  });

  it('restores a session the browser cookie still stands for', async () => {
    const auth = serviceWith({ get: () => of(session) });

    await expect(auth.restore()).resolves.toBe(true);
    expect(auth.admin()?.email).toBe('organizer@example.org');
    expect(auth.expiresAt()?.toISOString()).toBe('2026-08-26T21:00:00.000Z');
  });

  it('treats a rejected probe as "not logged in" rather than as a failure', async () => {
    const auth = serviceWith({
      get: () => throwError(() => ({ status: 401 })),
    });

    await expect(auth.restore()).resolves.toBe(false);
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('stops waiting for a server that never answers, so the login form renders', async () => {
    // Otherwise the startup initializer never settles and the page stays blank
    // — which is exactly what a stopped API behind the dev-server proxy did.
    const auth = serviceWith({ get: () => NEVER }, 10);

    await expect(auth.restore()).resolves.toBe(false);
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('logs in', async () => {
    const posted: { path: string; body: unknown }[] = [];
    const auth = serviceWith({
      post: (path, body) => {
        posted.push({ path, body });
        return of(session);
      },
    });

    await auth.login('organizer@example.org', 'a-long-enough-secret');

    expect(posted).toEqual([
      {
        path: 'admin/auth/login',
        body: {
          email: 'organizer@example.org',
          password: 'a-long-enough-secret',
        },
      },
    ]);
    expect(auth.isLoggedIn()).toBe(true);
  });

  it('keeps wrong credentials from looking like a session', async () => {
    const auth = serviceWith({
      post: () => throwError(() => ({ status: 401 })),
    });

    await expect(
      auth.login('organizer@example.org', 'wrong'),
    ).rejects.toMatchObject({ status: 401 });
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('ends the session locally even when the server cannot be reached', async () => {
    const auth = serviceWith({
      get: () => of(session),
      post: () => throwError(() => ({ status: 0 })),
    });
    await auth.restore();

    await expect(auth.logout()).rejects.toBeTruthy();

    // The browser is done with it either way — leaving the workspace open would
    // be worse than a stale row on the server, which expires by itself.
    expect(auth.isLoggedIn()).toBe(false);
  });
});

describe('isSessionProbe', () => {
  it.each(['/api/admin/auth/me', '/api/admin/auth/login'])(
    'exempts %s, where a 401 is the answer',
    (url) => {
      expect(isSessionProbe(url)).toBe(true);
    },
  );

  it('treats every other 401 as an expired session', () => {
    expect(isSessionProbe('/api/admin/admins')).toBe(false);
  });
});
