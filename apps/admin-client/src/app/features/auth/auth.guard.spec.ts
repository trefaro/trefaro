import { TestBed } from '@angular/core/testing';
import {
  UrlTree,
  provideRouter,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { SetupService } from '../setup/setup.service';
import { adminAuthGuard, notLoggedInGuard } from './auth.guard';
import { AuthService } from './auth.service';

function runGuard(
  guard: typeof adminAuthGuard,
  options: { loggedIn: boolean; url?: string; setupPending?: boolean },
): boolean | UrlTree {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { isLoggedIn: () => options.loggedIn },
      },
      {
        provide: SetupService,
        useValue: { isPending: () => options.setupPending ?? false },
      },
    ],
  });

  return TestBed.runInInjectionContext(
    () =>
      guard(
        {} as ActivatedRouteSnapshot,
        { url: options.url ?? '/' } as RouterStateSnapshot,
      ) as boolean | UrlTree,
  );
}

describe('adminAuthGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lets a logged-in organizer through', () => {
    expect(runGuard(adminAuthGuard, { loggedIn: true })).toBe(true);
  });

  it('sends a visitor to the login form', () => {
    const result = runGuard(adminAuthGuard, { loggedIn: false });

    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/login');
  });

  it('remembers where the organizer was heading', () => {
    const result = runGuard(adminAuthGuard, {
      loggedIn: false,
      url: '/administrators',
    });

    expect(String(result)).toBe('/login?returnTo=%2Fadministrators');
  });

  it('sends a visitor to the wizard while nobody can log in at all', () => {
    // A fresh instance has no administrator, so the login form is a door with no
    // key behind it (FR 1.1, E28). The return address is dropped on purpose:
    // after the setup the organizer signs in, and that is a new journey.
    const result = runGuard(adminAuthGuard, {
      loggedIn: false,
      setupPending: true,
      url: '/administrators',
    });

    expect(String(result)).toBe('/setup');
  });
});

describe('notLoggedInGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows the form to a visitor', () => {
    expect(runGuard(notLoggedInGuard, { loggedIn: false })).toBe(true);
  });

  it('sends someone who is already logged in to the workspace', () => {
    const result = runGuard(notLoggedInGuard, { loggedIn: true });

    expect(String(result)).toBe('/');
  });

  it('sends a visitor to the wizard while the instance is unclaimed', () => {
    const result = runGuard(notLoggedInGuard, {
      loggedIn: false,
      setupPending: true,
    });

    expect(String(result)).toBe('/setup');
  });
});
