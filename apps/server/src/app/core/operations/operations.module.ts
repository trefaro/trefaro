import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { OperationsController } from './operations.controller';
import { RequestOutcomeInterceptor } from './request-outcome.interceptor';
import { RuntimeMetricsService } from './runtime-metrics.service';

/**
 * The bookkeeping an operator reads (NFR 10, NFR 11, AP 10 of phase 5).
 *
 * Global for one reason: the counters have three writers that sit in three
 * different places — a global interceptor for the answers that worked, the
 * global exception filter for the ones that did not, and the mail service for
 * the deliveries that quietly stopped. A service two of those reach by
 * construction and the third by injection would be the same service provided
 * twice, and two tallies that each know half of the truth are worse than none.
 */
@Global()
@Module({
  controllers: [OperationsController],
  providers: [
    RuntimeMetricsService,
    { provide: APP_INTERCEPTOR, useClass: RequestOutcomeInterceptor },
  ],
  exports: [RuntimeMetricsService],
})
export class OperationsModule {}
