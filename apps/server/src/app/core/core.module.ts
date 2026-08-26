import { Module } from '@nestjs/common';
import { EnvModule } from './config/env.module';

/**
 * Cross-cutting concerns shared by every layer: configuration, logging and
 * error handling. Deliberately free of domain logic and of database access.
 */
@Module({ imports: [EnvModule], exports: [EnvModule] })
export class CoreModule {}
