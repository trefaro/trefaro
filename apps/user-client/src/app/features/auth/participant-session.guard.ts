import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { ParticipantSessionService } from './participant-session.service';

/**
 * Keeps the profile behind the login (FR 4.2, UC 09).
 *
 * Synchronous on purpose: the session has already been restored by a startup
 * initializer, so the guard only reads a signal and somebody who reloads their
 * profile does not flash through the login form. The server enforces the same
 * boundary regardless — this guard is about not showing an empty screen.
 *
 * An instance with accounts switched off has no login to send anybody to: every
 * route below `profiles` answers 404 there (F53), so the profile is not a page
 * that is closed but one that does not exist, and the start page is the honest
 * destination.
 */
export const participantSessionGuard: CanActivateFn = (_route, state) => {
  const session = inject(ParticipantSessionService);
  const router = inject(Router);

  if (!session.accountsEnabled()) return router.createUrlTree(['/']);
  if (session.isLoggedIn()) return true;

  // Remember where they were heading, so the login can send them on.
  return router.createUrlTree(['/profile/login'], {
    queryParams: state.url === '/profile' ? {} : { returnTo: state.url },
  });
};

/**
 * Sends somebody who is already logged in away from the login and the
 * registration form.
 *
 * To their profile rather than to the start page: they asked for something to
 * do with their account, and that is the page that answers it.
 */
export const participantAnonymousGuard: CanActivateFn = () => {
  const session = inject(ParticipantSessionService);
  const router = inject(Router);

  if (!session.accountsEnabled()) return router.createUrlTree(['/']);

  return session.isLoggedIn() ? router.createUrlTree(['/profile']) : true;
};
