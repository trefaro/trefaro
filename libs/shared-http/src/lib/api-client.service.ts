import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { toApiError, type ApiError } from './api-error';

/**
 * Single entry point for API calls from either client.
 *
 * Keeps the base path and error translation in one place, so feature code deals
 * with {@link ApiError} rather than with `HttpErrorResponse`, and no component
 * hard-codes `/api`.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  get<T>(path: string): Observable<T> {
    return this.request(this.http.get<T>(this.url(path)));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.request(this.http.post<T>(this.url(path), body));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.request(this.http.put<T>(this.url(path), body));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.request(this.http.patch<T>(this.url(path), body));
  }

  delete<T>(path: string, body?: unknown): Observable<T> {
    return this.request(
      this.http.delete<T>(this.url(path), body === undefined ? {} : { body }),
    );
  }

  /** Joins base and path with exactly one slash, whichever way either is written. */
  private url(path: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }

  private request<T>(source: Observable<T>): Observable<T> {
    return source.pipe(
      catchError((error: unknown) =>
        throwError((): ApiError =>
          error instanceof HttpErrorResponse
            ? toApiError(error)
            : {
                status: 0,
                message: 'The request could not be sent.',
                retryable: true,
              },
        ),
      ),
    );
  }
}
