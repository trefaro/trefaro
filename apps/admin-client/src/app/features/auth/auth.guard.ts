import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Keeps the organizer workspace behind the login (UC 01).
 *
 * Synchronous on purpose: the session has already been restored by a startup
 * initializer, so the guard only reads a signal. The server enforces the same
 * boundary regardless — this guard is about not showing an empty workspace.
 */
export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) return true;

  // Remember where the organizer was heading, so the login can send them on.
  return inject(Router).createUrlTree(['/login'], {
    queryParams: state.url === '/' ? {} : { returnTo: state.url },
  });
};

/** Sends an already-logged-in organizer away from the login form. */
export const notLoggedInGuard: CanActivateFn = () =>
  inject(AuthService).isLoggedIn() ? inject(Router).createUrlTree(['/']) : true;
