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
      refusal: null,
    });
  });

  it("reads the server's reason as a code and its values", () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 400,
        error: {
          statusCode: 400,
          message: 'problem.field.required',
          code: 'problem.field.required',
          params: { label: 'Passport scan' },
        },
      }),
    );

    expect(error.refusal).toEqual({
      code: 'problem.field.required',
      params: { label: 'Passport scan' },
    });
    expect(error.retryable).toBe(false);
  });

  it('keeps whatever text came with the answer, for a console', () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 404,
        error: { statusCode: 404, message: 'No event with id "7"' },
      }),
    );

    expect(error.message).toBe('No event with id "7"');
    // …and never for a screen: a 404 carries no code, so no reason is shown.
    expect(error.refusal).toBeNull();
  });

  it('accepts a plain string error body', () => {
    const error = toApiError(
      new HttpErrorResponse({ status: 404, error: 'Not Found' }),
    );

    expect(error.message).toBe('Not Found');
    expect(error.refusal).toBeNull();
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
    expect(error.refusal).toBeNull();
  });

  it("falls back to Angular's own status text when there is nothing else", () => {
    const error = toApiError(
      new HttpErrorResponse({ status: 418, error: null }),
    );

    expect(error.message).toBe('Unknown Error');
  });

  it('ignores a code this build has no sentence for', () => {
    // A newer server, an older client: the client says its own half and stays
    // silent about the other rather than printing a key at a reader.
    const error = toApiError(
      new HttpErrorResponse({
        status: 400,
        error: { code: 'problem.fromTheFuture.entirely' },
      }),
    );

    expect(error.refusal).toBeNull();
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
          error: {
            code: 'problem.program.full',
            params: { title: 'Opening plenary' },
          },
        }),
      ),
      'mine.error.save',
    );

    expect(problem).toEqual({
      key: 'mine.error.save',
      reason: {
        code: 'problem.program.full',
        params: { title: 'Opening plenary' },
      },
    });
  });

  it('drops a message the server never sent', () => {
    // "Not Found" underneath "this could not be loaded" is noise; the reader
    // gains nothing from reading the status code twice.
    const problem = problemOf(
      toApiError(new HttpErrorResponse({ status: 404, error: null })),
      'event.error',
    );

    expect(problem.reason).toBeNull();
  });

  it('survives something that is not an ApiError at all', () => {
    expect(problemOf(new Error('boom'), 'start.error')).toEqual({
      key: 'start.error',
      reason: null,
    });
    expect(problemOf(undefined, 'start.error').reason).toBeNull();
  });
});
