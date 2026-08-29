import { Injectable, computed, inject } from '@angular/core';
import { AppConfigService } from '@trefaro/shared-config';
import {
  publicEventPath,
  publicSeriesPath,
  publicUrl,
} from '@trefaro/shared-models';

/**
 * Addresses of the participant client, from the organizer client (AP 13).
 *
 * The organizer client cannot derive them. Behind the proxy both clients share
 * an origin under different paths; in development they are two ports. Only the
 * deployment knows, and it says so in `publicUserClientUrl` — which is why every
 * screen that used to show a public address as bare text could not offer it as a
 * link.
 *
 * {@link known} exists because the alternative to an origin is not a shorter
 * link but a wrong one: a bare `/series/…` would resolve against the organizer
 * client's own origin, which serves a completely different application. A screen
 * asks first and keeps showing the address as text when the answer is no.
 */
@Injectable({ providedIn: 'root' })
export class PublicSite {
  private readonly config = inject(AppConfigService);

  /** Whether this instance told us where the participant client answers. */
  readonly known = computed(() => this.config.publicUserClientUrl() !== '');

  series(slug: string): string {
    return this.absolute(publicSeriesPath(slug));
  }

  event(seriesSlug: string, eventSlug: string): string {
    return this.absolute(publicEventPath(seriesSlug, eventSlug));
  }

  private absolute(path: string): string {
    return publicUrl(this.config.publicUserClientUrl(), path);
  }
}
