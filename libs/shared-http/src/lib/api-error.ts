import { HttpErrorResponse } from '@angular/common/http';

/**
 * A failed request in terms the UI can act on.
 *
 * The distinction that matters to a participant is "you are offline" versus "the
 * server said no" — NFR 4 asks for an application usable by people with
 * rudimentary IT skills, and a raw status code is not that.
 */
export interface ApiError {
  /** 0 when the request never reached the server. */
  readonly status: number;
  /** Message from the server, or a reason the request never got there. */
  readonly message: string;
  /** True when retrying later could plausibly succeed. */
  readonly retryable: boolean;
}

interface ServerErrorBody {
  message?: unknown;
}

/** Turns Angular's error response into an {@link ApiError}. */
export function toApiError(response: HttpErrorResponse): ApiError {
  // Status 0 means the browser could not complete the request at all: offline,
  // DNS failure, or the server not listening.
  if (response.status === 0) {
    return {
      status: 0,
      message: 'The server could not be reached.',
      retryable: true,
    };
  }

  // Angular always fills `statusText`, defaulting it to 'Unknown Error', so it
  // is a safe last resort.
  const message =
    extractMessage(response.error as ServerErrorBody | string | null) ??
    response.statusText;

  return {
    status: response.status,
    message,
    // A client error will fail the same way on retry; a server error may not.
    retryable: response.status >= 500 || response.status === 429,
  };
}

/** The server's own message, if it sent a usable one. */
function extractMessage(body: ServerErrorBody | string | null): string | null {
  if (typeof body === 'string') {
    return body.length > 0 ? body : null;
  }
  if (body && typeof body.message === 'string' && body.message.length > 0) {
    return body.message;
  }
  return null;
}
