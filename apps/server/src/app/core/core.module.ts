import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EnvModule, RATE_LIMITS } from './config/env.module';
import type { RateLimitEnv } from './config/rate-limits';
import { OperationsModule } from './operations/operations.module';
import { buildThrottlers } from './throttling/throttlers';

/**
 * Cross-cutting concerns shared by every layer: configuration, logging, error
 * handling and rate limiting. Deliberately free of domain logic and of database
 * access.
 *
 * The limits come from the environment since phase 5 (E60), which is why the
 * throttler is registered asynchronously: a decorator cannot be injected into,
 * so the number a route used to spell out now lives in a named throttler that
 * the route selects with `@RateLimit`. `throttling/throttlers.ts` explains the
 * shape, and the default limit is still the generous one every route has always
 * had — an organizer clicking through the participant list must never be
 * throttled.
 *
 * `ThrottlerModule` is global, so the recipient counter and the socket.io
 * handshake counter reach the same storage from wherever they run.
 */
@Module({
  imports: [
    EnvModule,
    OperationsModule,
    ThrottlerModule.forRootAsync({
      imports: [EnvModule],
      inject: [RATE_LIMITS],
      useFactory: (limits: RateLimitEnv) => buildThrottlers(limits),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  exports: [EnvModule, OperationsModule],
})
export class CoreModule {}
