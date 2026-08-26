import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';

describe('toApiError', () => {
  it('reports an unreachable server as retryable', () => {
    const error = toApiError(
      new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }),
    );

    expect(error).toEqual({
      status: 0,
      message: 'The server could not be reached.',
      retryable: true,
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
