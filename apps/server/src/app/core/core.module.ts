import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, minutes } from '@nestjs/throttler';
import { EnvModule } from './config/env.module';

/**
 * Cross-cutting concerns shared by every layer: configuration, logging, error
 * handling and rate limiting. Deliberately free of domain logic and of database
 * access.
 *
 * The default limit is generous — a client fetches the configuration and a
 * handful of endpoints on startup, and an organizer clicking through the
 * participant list must never be throttled. Endpoints that are worth attacking
 * tighten it with `@Throttle`, as the login does.
 */
@Module({
  imports: [
    EnvModule,
    ThrottlerModule.forRoot([{ ttl: minutes(1), limit: 300 }]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  exports: [EnvModule],
})
export class CoreModule {}
