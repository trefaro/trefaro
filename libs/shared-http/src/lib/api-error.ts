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
  /**
   * Whether {@link message} is the server's own reason for refusing.
   *
   * False for everything this library made up on the server's behalf — the
   * offline case, and the status text Angular fills in when a response carries
   * no body. The difference matters from AP 8 of phase 2: a screen says what
   * happened in the reader's language and adds the server's reason beside it
   * (F77), and "Not Found" is not a reason worth repeating.
   */
  readonly explained: boolean;
}

/**
 * What a screen shows about a failed request (F77, AP 8 of phase 2).
 *
 * Two parts, because they come from different places and only one of them can
 * be translated: {@link key} is this client's own sentence, in the catalogue,
 * in the reader's language; {@link detail} is the server's reason, in English,
 * shown beside it when there is one. Dropping the reason would cost a
 * participant the one sentence that says *why* — that the last seat has gone,
 * or which file is too large.
 */
export interface Problem {
  /** Catalogue key of what this client can say about it. */
  readonly key: string;
  /** The server's own reason, or `null` when it gave none. */
  readonly detail: string | null;
  /**
   * Values for the `{{ }}` placeholders in {@link key}, when it has any.
   *
   * Beside the key rather than baked into a finished sentence, because the
   * sentence is only assembled when the view draws it — which is what lets a
   * message survive a language switch (F72).
   */
  readonly params?: Readonly<Record<string, unknown>>;
}

/** A {@link Problem} from a caught error and the key that describes it. */
export function problemOf(error: unknown, key: string): Problem {
  const api = error as ApiError | undefined;
  return {
    key,
    detail: api?.explained ? api.message : null,
  };
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
      explained: false,
    };
  }

  // Angular always fills `statusText`, defaulting it to 'Unknown Error', so it
  // is a safe last resort.
  const sent = extractMessage(
    response.error as ServerErrorBody | string | null,
  );

  return {
    status: response.status,
    message: sent ?? response.statusText,
    // A client error will fail the same way on retry; a server error may not.
    retryable: response.status >= 500 || response.status === 429,
    explained: sent !== null,
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
