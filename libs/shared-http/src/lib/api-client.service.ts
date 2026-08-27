import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { toApiError, type ApiError } from './api-error';

/** What a caller may put in a query string. */
export type QueryParams = Readonly<
  Record<string, string | number | boolean | null | undefined>
>;

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

  /**
   * A GET, optionally with a query string.
   *
   * `params` is spelled out here rather than built into the path by each caller
   * so that encoding happens once and in one place — the participant overview
   * sends a free-text search through it, and a name with a `&` in it must not
   * turn into a second parameter.
   *
   * Entries that are `undefined`, `null` or the empty string are omitted, which
   * is what lets a caller pass its whole state and get the short URL that
   * corresponds to the defaults.
   */
  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.request(
      this.http.get<T>(this.url(path), { params: toHttpParams(params) }),
    );
  }

  /**
   * A POST. A `FormData` body travels as multipart, everything else as JSON.
   *
   * Nothing to configure for that: the browser sets the content type of a
   * `FormData` body itself, including the boundary — which is why Angular must
   * not be given one, and why the registration form with a file field goes
   * through this same method.
   */
  post<T>(path: string, body: unknown): Observable<T> {
    return this.request(this.http.post<T>(this.url(path), body));
  }

  /**
   * A GET whose answer is a file rather than JSON.
   *
   * Fetched rather than linked to: an attachment is only readable with an
   * administrative session (E9), and a request carries it where a link opened
   * in a new tab may not.
   */
  file(path: string): Observable<Blob> {
    return this.request(
      this.http.get(this.url(path), { responseType: 'blob' }),
    );
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

/** Drops what is not set, so defaults do not show up in the URL. */
function toHttpParams(params: QueryParams | undefined): HttpParams {
  let result = new HttpParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    result = result.set(key, String(value));
  }
  return result;
}
