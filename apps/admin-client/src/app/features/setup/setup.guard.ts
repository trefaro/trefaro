import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SetupService } from './setup.service';

/**
 * Keeps the first-run wizard off an instance that has already been claimed
 * (FR 1.1).
 *
 * Synchronous like the session guard, and for the same reason: the probe has
 * already run in the startup initializer, so this only reads a signal. The
 * server decides regardless — both setup endpoints answer 404 once an
 * administrator exists, so a stale "pending" here costs a redirect, not a hole.
 *
 * The redirect goes to `/`, not to `/login`: from there the session guard sends
 * an organizer wherever they belong, which is one place that decision is made
 * instead of two.
 */
export const setupPendingGuard: CanActivateFn = () =>
  inject(SetupService).isPending() ? true : inject(Router).createUrlTree(['/']);
