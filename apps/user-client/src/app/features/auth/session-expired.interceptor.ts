import {
  HttpErrorResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import {
  ParticipantSessionService,
  isParticipantProbe,
} from './participant-session.service';

/**
 * Turns an expired session into a trip to the login form.
 *
 * Without it an idle session would surface as a profile page full of failed
 * requests: the person would see errors instead of being told to log in again.
 *
 * Runs inside `HttpClient`, so the error here is still an `HttpErrorResponse`;
 * the translation to `ApiError` happens further out, in the shared API client.
 *
 * The startup probe and the login are exempt — see {@link isParticipantProbe}.
 * Nothing else in this client can answer 401: every anonymous route of the
 * participant API is anonymous by its path (E33), so a 401 anywhere else really
 * is a session that has stopped being one.
 */
export const sessionExpiredInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(ParticipantSessionService);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isParticipantProbe(request.url)
      ) {
        session.clear();
        const returnTo = router.url;
        void router.navigate(['/profile/login'], {
          queryParams: returnTo === '/profile' ? {} : { returnTo },
        });
      }
      return throwError(() => error);
    }),
  );
};
