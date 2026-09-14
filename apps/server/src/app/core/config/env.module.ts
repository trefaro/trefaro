import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadEnv, TrefaroEnv } from './env';
import type { RateLimitEnv } from './rate-limits';

/** Injection token for the validated environment. */
export const ENV = Symbol('TREFARO_ENV');

/**
 * Injection token for just the rate limits.
 *
 * A narrowing of {@link ENV} rather than a second source: the throttling code
 * needs five numbers and a label, and a dependency on the whole environment
 * would make every test of it carry a database password.
 */
export const RATE_LIMITS = Symbol('TREFARO_RATE_LIMITS');

/**
 * Loads `.env` files and exposes the environment as one validated, typed object
 * under the {@link ENV} token. Global, because every layer needs configuration
 * but no layer should read `process.env` directly.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // A local .env stays out of version control; the deployed instance gets
      // its values from the container environment.
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
  ],
  providers: [
    { provide: ENV, useFactory: (): TrefaroEnv => loadEnv() },
    {
      provide: RATE_LIMITS,
      useFactory: (env: TrefaroEnv): RateLimitEnv => env.rateLimits,
      inject: [ENV],
    },
  ],
  exports: [ENV, RATE_LIMITS],
})
export class EnvModule {}
