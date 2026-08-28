import { Module } from '@nestjs/common';
import { AdminBrandingController } from './admin-branding.controller';
import { AdminConfigController } from './admin-config.controller';
import { AdminModulesController } from './admin-modules.controller';
import { BrandingMediaController } from './branding-media.controller';
import { BrandingService } from './branding.service';
import { ConfigurationController } from './configuration.controller';
import { ConfigurationService } from './configuration.service';
import { CoreModuleEnabledGuard } from './core-module-enabled.guard';
import { CoreModuleRegistryService } from './core-module-registry.service';
import { ModuleAdminService } from './module-admin.service';

/**
 * Configuration module of the business layer (FR 1.4 / FR 1.5).
 *
 * Named `Configuration…` rather than `Config…` to keep it distinct from
 * NestJS's own `ConfigModule`, which only reads the environment.
 *
 * The repository ports it depends on are bound by the composition root, so this
 * module compiles without knowing that PostgreSQL exists.
 *
 * Since AP 2 of phase 2 it also owns the two branding images: the writing side
 * under `/api/admin/config/{logo,app-icon}`, because they are two more values of
 * the same configuration, and the public route that serves them under
 * `/api/media/branding` (E19). One module for both halves — the rule that a
 * branding file is never an attachment is only a rule if one place enforces it
 * in both directions.
 *
 * It also owns which optional core modules are switched on
 * ({@link CoreModuleRegistryService}) and the guard that turns a switched-off
 * one into a 404 (F53). A module with optional endpoints — `media-links` was the
 * first, `push` the second — imports this module for the guard, exactly as a
 * plug-in gets its guard from the plug-in manager.
 *
 * Since AP 4 of phase 2 it also carries the *writing* side of that switch
 * ({@link ModuleAdminService}), for both families. That composition belongs here
 * rather than in the plug-in manager for the same reason `ConfigurationService`
 * does: the answer both clients fetch already joins core modules and plug-ins,
 * and the administration is that answer with the disabled ones still in it.
 */
@Module({
  controllers: [
    ConfigurationController,
    AdminConfigController,
    AdminBrandingController,
    AdminModulesController,
    BrandingMediaController,
  ],
  providers: [
    ConfigurationService,
    BrandingService,
    CoreModuleRegistryService,
    CoreModuleEnabledGuard,
    ModuleAdminService,
  ],
  exports: [
    ConfigurationService,
    BrandingService,
    CoreModuleRegistryService,
    CoreModuleEnabledGuard,
  ],
})
export class ConfigurationModule {}
