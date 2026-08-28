import { TestBed } from '@angular/core/testing';
import { STARTUP_TIMEOUT_MS } from '@trefaro/shared-config';
import { ApiClient } from '@trefaro/shared-http';
import { SETUP_TOKEN_HEADER, type SetupState } from '@trefaro/shared-models';
import { Observable, of, throwError } from 'rxjs';
import { SetupService } from './setup.service';

const STATE: SetupState = {
  organizationName: 'Trefaro',
  primaryColor: '#1f6f5c',
  accentColor: '#e8a33d',
  defaultLocale: 'en',
  locales: ['en', 'de'],
  warnings: [
    'SMTP_HOST is localhost: registrations need a double opt-in mail.',
  ],
};

const SUBMISSION = {
  admin: {
    email: 'organizer@example.org',
    name: 'Alex Weber',
    password: 'a-long-enough-passphrase',
  },
  organizationName: 'Democracy International e.V.',
  defaultLocale: 'de',
  primaryColor: '#1f6f5c',
  accentColor: '#e8a33d',
} as const;

interface Call {
  readonly path: string;
  readonly headers: Record<string, string> | undefined;
  readonly body?: unknown;
}

function serviceWith(options: {
  get?: (headers?: Record<string, string>) => Observable<unknown>;
  post?: (headers?: Record<string, string>) => Observable<unknown>;
}): { setup: SetupService; calls: Call[] } {
  const calls: Call[] = [];

  TestBed.configureTestingModule({
    providers: [
      { provide: STARTUP_TIMEOUT_MS, useValue: 5_000 },
      {
        provide: ApiClient,
        useValue: {
          get: (
            path: string,
            _params?: unknown,
            headers?: Record<string, string>,
          ) => {
            calls.push({ path, headers });
            return (
              options.get?.(headers) ?? throwError(() => ({ status: 401 }))
            );
          },
          post: (
            path: string,
            body: unknown,
            headers?: Record<string, string>,
          ) => {
            calls.push({ path, headers, body });
            return (
              options.post?.(headers) ?? throwError(() => ({ status: 404 }))
            );
          },
        },
      },
    ],
  });

  return { setup: TestBed.inject(SetupService), calls };
}

/**
 * Whether this instance still has to be claimed (FR 1.1, E28).
 *
 * The interesting part is that availability is read from a *status code*: the
 * server hands the state out only against the token, so the probe deliberately
 * sends none and reads 401 as "unclaimed", 404 as "done".
 */
describe('SetupService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('starts out assuming the instance is set up', () => {
    const { setup } = serviceWith({});

    // The safe assumption: a login form on a fresh instance is an extra click,
    // a wizard on a running one is a puzzle.
    expect(setup.isPending()).toBe(false);
    expect(setup.isUnlocked()).toBe(false);
  });

  it('reads a 401 without a token as "nobody can log in here yet"', async () => {
    const { setup, calls } = serviceWith({
      get: () => throwError(() => ({ status: 401 })),
    });

    await expect(setup.probe()).resolves.toBe(true);
    expect(setup.isPending()).toBe(true);
    // No token on the probe, and no body received — the availability is the
    // status code alone.
    expect(calls).toEqual([{ path: 'setup/state', headers: undefined }]);
    expect(setup.state()).toBeNull();
  });

  it('reads a 404 as "this instance has an administrator"', async () => {
    const { setup } = serviceWith({
      get: () => throwError(() => ({ status: 404 })),
    });

    await expect(setup.probe()).resolves.toBe(false);
    expect(setup.isPending()).toBe(false);
  });

  it('treats an unreachable server as set up rather than showing a wizard', async () => {
    const { setup } = serviceWith({
      get: () => throwError(() => ({ status: 0 })),
    });

    await expect(setup.probe()).resolves.toBe(false);
  });

  it('sends the token in the header when it exchanges it for the state', async () => {
    const { setup, calls } = serviceWith({ get: () => of(STATE) });

    await expect(setup.unlock('the-token')).resolves.toEqual(STATE);
    expect(calls[0].headers).toEqual({ [SETUP_TOKEN_HEADER]: 'the-token' });
    expect(setup.isUnlocked()).toBe(true);
    expect(setup.state()?.locales).toEqual(['en', 'de']);
  });

  it('keeps a wrong token out of its memory', async () => {
    const { setup } = serviceWith({
      get: () => throwError(() => ({ status: 401 })),
    });

    await expect(setup.unlock('wrong')).rejects.toMatchObject({ status: 401 });
    expect(setup.isUnlocked()).toBe(false);
    // And the submission cannot be attempted with it.
    await expect(setup.complete(SUBMISSION)).rejects.toThrow(
      'has not been accepted',
    );
  });

  it('submits with the accepted token and forgets everything afterwards', async () => {
    const { setup, calls } = serviceWith({
      get: () => of(STATE),
      post: () =>
        of({
          adminEmail: 'organizer@example.org',
          organizationName: 'Democracy International e.V.',
        }),
    });

    await setup.unlock('the-token');
    const result = await setup.complete(SUBMISSION);

    expect(result.adminEmail).toBe('organizer@example.org');
    expect(calls[1]).toEqual({
      path: 'setup/admin',
      headers: { [SETUP_TOKEN_HEADER]: 'the-token' },
      body: SUBMISSION,
    });
    // The route answers 404 for everybody from here, this page included.
    expect(setup.isPending()).toBe(false);
    expect(setup.isUnlocked()).toBe(false);
  });

  it('keeps the token after a refused submission, so the form can be corrected', async () => {
    const { setup } = serviceWith({
      get: () => of(STATE),
      post: () => throwError(() => ({ status: 400, message: 'bad colour' })),
    });

    await setup.unlock('the-token');
    await expect(setup.complete(SUBMISSION)).rejects.toMatchObject({
      status: 400,
    });

    expect(setup.isUnlocked()).toBe(true);
  });
});
