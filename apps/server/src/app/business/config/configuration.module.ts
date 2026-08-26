import { Module } from '@nestjs/common';
import { ConfigurationController } from './configuration.controller';
import { ConfigurationService } from './configuration.service';

/**
 * Configuration module of the business layer (FR 1.4 / FR 1.5).
 *
 * Named `Configuration…` rather than `Config…` to keep it distinct from
 * NestJS's own `ConfigModule`, which only reads the environment.
 *
 * The repository ports it depends on are bound by the composition root, so this
 * module compiles without knowing that PostgreSQL exists.
 */
@Module({
  controllers: [ConfigurationController],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
