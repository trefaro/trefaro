import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

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

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request: unknown = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ErrorBody = {
      statusCode: status,
      // Expected errors carry a client-safe message; anything else does not.
      message:
        exception instanceof HttpException
          ? exception.message
          : 'Internal server error',
      path: httpAdapter.getRequestUrl(request) ?? '',
      timestamp: new Date().toISOString(),
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${status} ${body.path}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (EXPECTED_STATUSES.has(status)) {
      // Not warnings: every client that is not logged in asks who it is, and
      // every disabled plug-in answers 404. Logging those at warning level
      // fills an operator's log with normal traffic and buries the real ones.
      this.logger.debug(`${status} ${body.path} — ${body.message}`);
    } else {
      this.logger.warn(`${status} ${body.path} — ${body.message}`);
    }

    httpAdapter.reply(ctx.getResponse(), body, status);
  }
}
