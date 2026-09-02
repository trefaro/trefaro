import { TestBed } from '@angular/core/testing';
import {
  UrlTree,
  provideRouter,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import {
  participantAnonymousGuard,
  participantSessionGuard,
} from './participant-session.guard';
import { ParticipantSessionService } from './participant-session.service';

function runGuard(
  guard: typeof participantSessionGuard,
  options: { loggedIn: boolean; url?: string; accounts?: boolean },
): boolean | UrlTree {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ParticipantSessionService,
        useValue: {
          isLoggedIn: () => options.loggedIn,
          accountsEnabled: () => options.accounts ?? true,
        },
      },
    ],
  });

  return TestBed.runInInjectionContext(
    () =>
      guard(
        {} as ActivatedRouteSnapshot,
        { url: options.url ?? '/profile' } as RouterStateSnapshot,
      ) as boolean | UrlTree,
  );
}

describe('participantSessionGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lets a logged-in participant through', () => {
    expect(runGuard(participantSessionGuard, { loggedIn: true })).toBe(true);
  });

  it('sends a visitor to the login form', () => {
    const result = runGuard(participantSessionGuard, { loggedIn: false });

    expect(result).toBeInstanceOf(UrlTree);
    // No `returnTo` for the profile itself: the login goes there anyway, and a
    // parameter that repeats the default is a longer URL saying nothing.
    expect(String(result)).toBe('/profile/login');
  });

  it('remembers a deeper destination', () => {
    const result = runGuard(participantSessionGuard, {
      loggedIn: false,
      url: '/profile/registrations',
    });

    expect(String(result)).toBe(
      '/profile/login?returnTo=%2Fprofile%2Fregistrations',
    );
  });

  // Not to the login form: on such an instance there is nothing to log in to,
  // and the profile is a page that does not exist rather than one that is
  // closed. One test per case, because `TestBed` can only be configured once.
  it.each([false, true])(
    'sends a visitor home while accounts are off, logged in: %s (F53)',
    (loggedIn) => {
      const result = runGuard(participantSessionGuard, {
        loggedIn,
        accounts: false,
      });

      expect(String(result)).toBe('/');
    },
  );
});

describe('participantAnonymousGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lets a visitor reach the login and the registration form', () => {
    expect(runGuard(participantAnonymousGuard, { loggedIn: false })).toBe(true);
  });

  it('sends somebody who is already logged in to their profile', () => {
    const result = runGuard(participantAnonymousGuard, { loggedIn: true });

    expect(String(result)).toBe('/profile');
  });

  it('sends everybody home while accounts are switched off', () => {
    expect(
      String(
        runGuard(participantAnonymousGuard, {
          loggedIn: false,
          accounts: false,
        }),
      ),
    ).toBe('/');
  });
});
