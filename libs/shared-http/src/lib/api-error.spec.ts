import { HttpErrorResponse } from '@angular/common/http';
import { problemOf, toApiError } from './api-error';

describe('toApiError', () => {
  it('reports an unreachable server as retryable', () => {
    const error = toApiError(
      new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }),
    );

    expect(error).toEqual({
      status: 0,
      message: 'The server could not be reached.',
      retryable: true,
      // Not the server's own words: this library wrote that sentence, and a
      // screen must not repeat it beside its own (F77).
      explained: false,
    });
  });

  it("uses the server's message when it sends one", () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 400,
        error: {
          statusCode: 400,
          message: 'A room must have a capacity of at least 1',
        },
      }),
    );

    expect(error.message).toBe('A room must have a capacity of at least 1');
    expect(error.retryable).toBe(false);
    expect(error.explained).toBe(true);
  });

  it('accepts a plain string error body', () => {
    const error = toApiError(
      new HttpErrorResponse({ status: 404, error: 'Not Found' }),
    );

    expect(error.message).toBe('Not Found');
  });

  it('falls back to the status text when the body carries no message', () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 403,
        statusText: 'Forbidden',
        error: {},
      }),
    );

    expect(error.message).toBe('Forbidden');
    // Angular's word for the status code, not a reason anybody wrote down.
    expect(error.explained).toBe(false);
  });

  it("falls back to Angular's own status text when there is nothing else", () => {
    const error = toApiError(
      new HttpErrorResponse({ status: 418, error: null }),
    );

    expect(error.message).toBe('Unknown Error');
  });

  it('treats server errors and rate limiting as retryable, client errors as not', () => {
    const retryable = (status: number) =>
      toApiError(new HttpErrorResponse({ status, error: {} })).retryable;

    expect(retryable(500)).toBe(true);
    expect(retryable(503)).toBe(true);
    expect(retryable(429)).toBe(true);
    expect(retryable(400)).toBe(false);
    expect(retryable(404)).toBe(false);
  });
});

describe('problemOf', () => {
  it("carries the server's reason beside the key when it gave one", () => {
    const problem = problemOf(
      toApiError(
        new HttpErrorResponse({
          status: 409,
          error: { message: 'This session is full' },
        }),
      ),
      'mine.error.save',
    );

    expect(problem).toEqual({
      key: 'mine.error.save',
      detail: 'This session is full',
    });
  });

  it('drops a message the server never sent', () => {
    // "Not Found" underneath "this could not be loaded" is noise; the reader
    // gains nothing from reading the status code twice.
    const problem = problemOf(
      toApiError(new HttpErrorResponse({ status: 404, error: null })),
      'event.error',
    );

    expect(problem.detail).toBeNull();
  });

  it('survives something that is not an ApiError at all', () => {
    expect(problemOf(new Error('boom'), 'start.error')).toEqual({
      key: 'start.error',
      detail: null,
    });
    expect(problemOf(undefined, 'start.error').detail).toBeNull();
  });
});
