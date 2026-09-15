import {
  BadRequestException,
  ConflictException,
  HttpException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  readRefusal,
  type ProblemCode,
  type ProblemParams,
  type Refusal,
} from '@trefaro/shared-models';

/**
 * How the business layer refuses a request (E64, AP 5 of phase 5).
 *
 * Until this package a refusal was an English sentence, and the participant
 * client showed it under its own German one (F77). The sentence is gone: what
 * travels is a **code** — a catalogue key from the closed list in
 * `shared-models` — and the values its gaps are filled with. The client looks
 * the sentence up in the language of the reader; the server never knows which
 * language that is, and does not have to.
 *
 * Three doors because there are three answers, and the status is part of what a
 * client does next: {@link refuse} for a request that is wrong (400),
 * {@link conflict} for one that is well formed and refused by the state of the
 * instance (409), and {@link tooLarge} for one whose files are the reason
 * (413). Nothing else changed about them — they are the same Nest exceptions
 * every route already answers with.
 *
 * The code is also the exception's `message`, which is not a duplicate for its
 * own sake: it is what a log line prints, what a stack trace carries, and what
 * `expect(…).toThrow('problem.…')` matches — and there is no sentence left for
 * any of the three to name.
 */
function body(
  code: ProblemCode,
  params?: ProblemParams,
): Record<string, unknown> {
  return params === undefined
    ? { message: code, code }
    : { message: code, code, params };
}

/** A request that is wrong — 400, with the reason as a code. */
export function refuse(
  code: ProblemCode,
  params?: ProblemParams,
): BadRequestException {
  return new BadRequestException(body(code, params));
}

/** A request the state of the instance refuses — 409, with the reason. */
export function conflict(
  code: ProblemCode,
  params?: ProblemParams,
): ConflictException {
  return new ConflictException(body(code, params));
}

/** A request whose files are too heavy — 413, with the reason. */
export function tooLarge(
  code: ProblemCode,
  params?: ProblemParams,
): PayloadTooLargeException {
  return new PayloadTooLargeException(body(code, params));
}

/**
 * The refusal inside an error, or `null` for anything that is not one.
 *
 * Read by the exception filter on its way out and by the specs that assert the
 * reason rather than the class. A code this build does not know reads as no
 * refusal at all: it would reach a screen as its own key, which is worse than
 * the client's own sentence standing alone.
 */
export function refusalOf(error: unknown): Refusal | null {
  return error instanceof HttpException
    ? readRefusal(error.getResponse())
    : null;
}
