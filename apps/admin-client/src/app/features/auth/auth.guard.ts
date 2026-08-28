import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SetupService } from '../setup/setup.service';
import { AuthService } from './auth.service';

/**
 * Keeps the organizer workspace behind the login (UC 01).
 *
 * Synchronous on purpose: the session has already been restored by a startup
 * initializer, so the guard only reads a signal. The server enforces the same
 * boundary regardless — this guard is about not showing an empty workspace.
 *
 * On an instance that has no administrator at all the login form is a door with
 * no key behind it, so the wizard takes its place (FR 1.1, E28).
 */
export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) return true;

  const router = inject(Router);
  if (inject(SetupService).isPending()) {
    return router.createUrlTree(['/setup']);
  }

  // Remember where the organizer was heading, so the login can send them on.
  return router.createUrlTree(['/login'], {
    queryParams: state.url === '/' ? {} : { returnTo: state.url },
  });
};

/** Sends an already-logged-in organizer away from the login form. */
export const notLoggedInGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (inject(AuthService).isLoggedIn()) return router.createUrlTree(['/']);

  return inject(SetupService).isPending()
    ? router.createUrlTree(['/setup'])
    : true;
};
