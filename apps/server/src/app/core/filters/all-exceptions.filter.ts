import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { randomBytes } from 'node:crypto';
import { readRefusal, type ProblemParams } from '@trefaro/shared-models';
import type { RuntimeMetricsService } from '../operations/runtime-metrics.service';
import { redactPath } from './redact-path';

/**
 * Client errors that occur in normal operation and say nothing about a fault.
 *
 * 429 is deliberately *not* here: someone hitting the rate limit is worth
 * seeing.
 */
const EXPECTED_STATUSES: ReadonlySet<number> = new Set([
  HttpStatus.UNAUTHORIZED,
  HttpStatus.NOT_FOUND,
]);

interface ErrorBody {
  statusCode: number;
  message: string;
  path: string;
  timestamp: string;
  /**
   * The catalogue key of the reason, when the business layer gave one (E64).
   *
   * Beside {@link message} rather than instead of it: `message` is what a log
   * line and a stack trace print, and since AP 5 of phase 5 it prints this same
   * code, because a refusal has no sentence left to print. The field is what
   * the contract suite asserts and what a client translates.
   */
  code?: string;
  /** The values the reason's sentence has gaps for. */
  params?: ProblemParams;
  /**
   * A mark for this one fault, on a 5xx and never on anything else (AP 10).
   *
   * Eight hex characters, made here and written into the log line beside the
   * stack trace. It is the whole answer to "an operator can tell from the logs
   * what went wrong without finding an address in them": whoever was looking at
   * the screen can read this string out, and it is enough to find the one entry
   * that has the stack in it — so nothing about *who* was asking has to be
   * logged for a fault to be diagnosable.
   *
   * Absent below 500 on purpose. A 404 or a refused field needs no
   * investigation, and a mark on one would train people to quote a number that
   * leads nowhere.
   */
  incident?: string;
}

/**
 * Turns every uncaught error into a logged, well-formed JSON response.
 *
 * NFR 10 (a fault must not bring the system down) and NFR 11 (errors are caught
 * and recorded). This matters most for plug-ins: a broken plug-in endpoint must
 * fail as one request, never as the whole instance, and must not leak internals
 * to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    /**
     * Optional because a filter that cannot answer without its bookkeeping is
     * a filter that turns a broken counter into a broken instance (NFR 10).
     */
    private readonly metrics?: RuntimeMetricsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request: unknown = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const refusal =
      exception instanceof HttpException
        ? readRefusal(exception.getResponse())
        : null;

    // The values a caller put in the query string never reach the log, and
    // never travel back in the answer either — an error body is the thing
    // somebody pastes into a bug report (`redact-path.ts`).
    const path = redactPath(httpAdapter.getRequestUrl(request) ?? '');
    const incident =
      status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? randomBytes(4).toString('hex')
        : undefined;

    const body: ErrorBody = {
      statusCode: status,
      // Expected errors carry a client-safe message; anything else does not.
      message:
        exception instanceof HttpException
          ? exception.message
          : 'Internal server error',
      path,
      timestamp: new Date().toISOString(),
      ...(incident === undefined ? {} : { incident }),
      ...(refusal === null
        ? {}
        : {
            code: refusal.code,
            ...(refusal.params && { params: refusal.params }),
          }),
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${status} ${incident} ${path}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (EXPECTED_STATUSES.has(status)) {
      // Not warnings: every client that is not logged in asks who it is, and
      // every disabled plug-in answers 404. Logging those at warning level
      // fills an operator's log with normal traffic and buries the real ones.
      this.logger.debug(`${status} ${path} — ${body.message}`);
    } else {
      this.logger.warn(`${status} ${path} — ${body.message}`);
    }

    this.metrics?.recordFailure(status, path, incident);

    httpAdapter.reply(ctx.getResponse(), body, status);
  }
}
