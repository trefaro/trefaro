import { Module } from '@nestjs/common';
import { AdminConfigController } from './admin-config.controller';
import { ConfigurationController } from './configuration.controller';
import { ConfigurationService } from './configuration.service';
import { CoreModuleEnabledGuard } from './core-module-enabled.guard';
import { CoreModuleRegistryService } from './core-module-registry.service';

/**
 * Configuration module of the business layer (FR 1.4 / FR 1.5).
 *
 * Named `Configuration…` rather than `Config…` to keep it distinct from
 * NestJS's own `ConfigModule`, which only reads the environment.
 *
 * The repository ports it depends on are bound by the composition root, so this
 * module compiles without knowing that PostgreSQL exists.
 *
 * It also owns which optional core modules are switched on
 * ({@link CoreModuleRegistryService}) and the guard that turns a switched-off
 * one into a 404 (F53). A module with optional endpoints — `media-links` is the
 * first — imports this module for the guard, exactly as a plug-in gets its guard
 * from the plug-in manager.
 */
@Module({
  controllers: [ConfigurationController, AdminConfigController],
  providers: [
    ConfigurationService,
    CoreModuleRegistryService,
    CoreModuleEnabledGuard,
  ],
  exports: [
    ConfigurationService,
    CoreModuleRegistryService,
    CoreModuleEnabledGuard,
  ],
})
export class ConfigurationModule {}
