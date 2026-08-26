import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadEnv, TrefaroEnv } from './env';

/** Injection token for the validated environment. */
export const ENV = Symbol('TREFARO_ENV');

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
  providers: [{ provide: ENV, useFactory: (): TrefaroEnv => loadEnv() }],
  exports: [ENV],
})
export class EnvModule {}
