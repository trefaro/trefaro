import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { RuntimeMetricsService } from './runtime-metrics.service';

/**
 * Counts the answers that worked (NFR 11).
 *
 * The other half of the tally lives in `AllExceptionsFilter`, and the split is
 * not tidiness: a guard that refuses a request throws **before** any
 * interceptor runs, so an interceptor alone would never see a 401 or a 429 —
 * the two outcomes an operator most wants counted. A filter alone would never
 * see a success. So the filter counts everything that failed, this counts
 * everything that did not, and neither can count the same request twice.
 *
 * Only HTTP. A socket.io frame is not a request, has no status, and would make
 * a chatty conversation look like traffic that never fails.
 */
@Injectable()
export class RequestOutcomeInterceptor implements NestInterceptor {
  constructor(private readonly metrics: RuntimeMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    return next
      .handle()
      .pipe(tap({ next: () => this.metrics.recordSuccess() }));
  }
}
