import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { RequestOutcomeInterceptor } from './request-outcome.interceptor';
import { RuntimeMetricsService } from './runtime-metrics.service';

function context(type: 'http' | 'ws'): ExecutionContext {
  return { getType: () => type } as unknown as ExecutionContext;
}

function handler(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

describe('RequestOutcomeInterceptor', () => {
  it('counts an answer that worked', async () => {
    const metrics = new RuntimeMetricsService();

    await new Promise((resolve) =>
      new RequestOutcomeInterceptor(metrics)
        .intercept(context('http'), handler({ events: [] }))
        .subscribe({ complete: () => resolve(null) }),
    );

    expect(metrics.snapshot().requests.succeeded).toBe(1);
  });

  it('counts nothing when the handler threw — that is the filter’s half', async () => {
    const metrics = new RuntimeMetricsService();

    await new Promise((resolve) =>
      new RequestOutcomeInterceptor(metrics)
        .intercept(context('http'), {
          handle: () => throwError(() => new Error('boom')),
        })
        .subscribe({ error: () => resolve(null) }),
    );

    expect(metrics.snapshot().requests.succeeded).toBe(0);
  });

  it('leaves the chat alone, because a frame is not a request', async () => {
    const metrics = new RuntimeMetricsService();

    await new Promise((resolve) =>
      new RequestOutcomeInterceptor(metrics)
        .intercept(context('ws'), handler('typing'))
        .subscribe({ complete: () => resolve(null) }),
    );

    expect(metrics.snapshot().requests.succeeded).toBe(0);
  });
});
