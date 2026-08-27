export { CORE_MODULES, type CoreModuleDescriptor } from './core-modules';
export {
  CoreModuleController,
  CoreModuleEnabledGuard,
} from './core-module-enabled.guard';
export { CoreModuleRegistryService } from './core-module-registry.service';
export { MODULE_FLAG_REFRESH_MS, ModuleFlagCache } from './module-flags';
export { ConfigurationModule } from './configuration.module';
export { ConfigurationService } from './configuration.service';
export {
  APP_CONFIG_REPOSITORY,
  type AppConfigRecord,
  type AppConfigRepository,
} from './ports/app-config.repository';
export {
  MODULE_CONFIG_REPOSITORY,
  type ModuleConfigRecord,
  type ModuleConfigRepository,
  type ModuleDefault,
} from './ports/module-config.repository';
