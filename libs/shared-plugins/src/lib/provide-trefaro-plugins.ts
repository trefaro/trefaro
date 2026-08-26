import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { PluginLoaderService } from './plugin-loader.service';

/**
 * Startup step three: load the web components of the enabled plug-ins.
 *
 * Registered alongside `provideTrefaroConfig()`. Order between the two does not
 * matter — the loader awaits the configuration itself.
 *
 * Never rejects: a plug-in that cannot be loaded is recorded as failed and the
 * application starts without it.
 */
export function provideTrefaroPlugins(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() =>
      inject(PluginLoaderService).loadEnabledPlugins(),
    ),
  ]);
}
