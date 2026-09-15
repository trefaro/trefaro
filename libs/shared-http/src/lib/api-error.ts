import { HttpErrorResponse } from '@angular/common/http';
import { readRefusal, type Refusal } from '@trefaro/shared-models';

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
   * The server's own reason for refusing, or `null` when it gave none.
   *
   * A catalogue key and its values since AP 5 of phase 5 (E64), so the reason
   * can be read in the language of the reader. `null` for everything this
   * library made up on the server's behalf — the offline case, the status text
   * Angular fills in — and for every answer that carries no code: a 404, a
   * failed DTO validation, an error from outside the business layer.
   * {@link message} keeps whatever text came with the answer, for a console and
   * never for a screen.
   */
  readonly refusal: Refusal | null;
}

/**
 * What a screen shows about a failed request (F77, AP 8 of phase 2).
 *
 * Two parts, because they come from different places: {@link key} is this
 * client's own sentence for what did not work, {@link reason} is the server's
 * for why. Dropping the reason would cost a participant the one sentence that
 * says *why* — that the last seat has gone, or which file is too large.
 *
 * Both halves are catalogue keys since AP 5 of phase 5 (E64). Until then the
 * second one was an English sentence the server had written, which is what F77
 * settled for and what this package finally undid.
 */
export interface Problem {
  /** Catalogue key of what this client can say about it. */
  readonly key: string;
  /**
   * Values for the `{{ }}` placeholders in {@link key}, when it has any.
   *
   * Beside the key rather than baked into a finished sentence, because the
   * sentence is only assembled when the view draws it — which is what lets a
   * message survive a language switch (F72).
   */
  readonly params?: Readonly<Record<string, unknown>>;
  /**
   * The server's reason, as a catalogue key and its values, or `null`.
   *
   * A key and not a sentence since AP 5 of phase 5: the half a person reads for
   * the *why* is now in their language too. A screen draws it the same way it
   * draws {@link key} — `reason.code | transloco: reason.params` — and drawing
   * nothing when there is nothing is the normal case, not an error.
   */
  readonly reason: Refusal | null;
}

/** A {@link Problem} from a caught error and the key that describes it. */
export function problemOf(error: unknown, key: string): Problem {
  const api = error as ApiError | undefined;
  return { key, reason: api?.refusal ?? null };
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
      refusal: null,
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
    refusal: readRefusal(response.error),
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
