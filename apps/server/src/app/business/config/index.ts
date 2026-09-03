export { CORE_MODULES, type CoreModuleDescriptor } from './core-modules';
export {
  CoreModuleController,
  CoreModuleEnabledGuard,
  CoreModuleRoute,
} from './core-module-enabled.guard';
export { CoreModuleRegistryService } from './core-module-registry.service';
export { MODULE_FLAG_REFRESH_MS, ModuleFlagCache } from './module-flags';
export {
  BRANDING_URL_PREFIX,
  MEDIA_URL_PREFIX,
  brandingImageUrls,
} from './branding-url';
export {
  BrandingService,
  type BrandingImageBytes,
  type BrandingImageDescription,
  type BrandingImageUpload,
} from './branding.service';
export { ConfigurationModule } from './configuration.module';
export { ConfigurationService } from './configuration.service';
export { ModuleAdminService } from './module-admin.service';
export {
  APP_CONFIG_REPOSITORY,
  type AppConfigReader,
  type AppConfigRecord,
  type AppConfigRepository,
} from './ports/app-config.repository';
export {
  MODULE_CONFIG_REPOSITORY,
  type ModuleConfigRecord,
  type ModuleConfigRepository,
  type ModuleDefault,
} from './ports/module-config.repository';
