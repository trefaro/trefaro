import {
  HttpErrorResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService, isSessionProbe } from './auth.service';

/**
 * Turns an expired session into a trip to the login form.
 *
 * Without this, an idle session would surface as a page full of failed requests
 * — the organizer would see errors instead of being told to log in again.
 *
 * Runs inside `HttpClient`, so the error here is still an `HttpErrorResponse`;
 * the translation to `ApiError` happens further out, in the shared API client.
 *
 * The login and the session probe are exempt (see {@link isSessionProbe}).
 */
export const unauthorizedInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isSessionProbe(request.url)
      ) {
        auth.clear();
        const returnTo = router.url;
        void router.navigate(['/login'], {
          queryParams: returnTo === '/' ? {} : { returnTo },
        });
      }
      return throwError(() => error);
    }),
  );
};
