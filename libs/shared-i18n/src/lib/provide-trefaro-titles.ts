import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { TitleStrategy } from '@angular/router';
import { TrefaroTitleStrategy } from './title.strategy';

/**
 * Makes the browser tab say the organization's name (FR 1.4).
 *
 * Separate from {@link provideTrefaroTranslations} and registered next to
 * `provideRouter` in each client, because it replaces a router service — a
 * provider that quietly swapped the router's title strategy from inside the
 * translation setup would be a surprise in the place people look for one.
 */
export function provideTrefaroTitles(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: TitleStrategy, useClass: TrefaroTitleStrategy },
  ]);
}
