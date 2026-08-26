import {
  EnvironmentProviders,
  makeEnvironmentProviders,
  provideAppInitializer,
  inject,
} from '@angular/core';
import { ThemeService } from '@trefaro/shared-theming';
import { AppConfigService } from './app-config.service';

/**
 * Startup step one: fetch the configuration and apply the theme.
 *
 * The client start sequence the thesis' runtime view prescribes — configuration
 * first, theme second, plug-in web components third. Register this in both
 * clients' application config; `provideTrefaroPlugins()` covers the third step.
 *
 * A failed fetch does not block startup. The theme service keeps its fallback
 * palette, so a participant reaching the public start page while the server is
 * restarting sees a plain but working page instead of a blank one (NFR 10).
 */
export function provideTrefaroConfig(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(async () => {
      const config = inject(AppConfigService);
      const theme = inject(ThemeService);

      try {
        theme.apply((await config.ensureLoaded()).theme);
      } catch {
        // Reported by the API client's error mapping; startup continues on the
        // fallback theme.
      }
    }),
  ]);
}
