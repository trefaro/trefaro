export { CORE_MODULES, type CoreModuleDescriptor } from './core-modules';
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
