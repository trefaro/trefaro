import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type { PublicMediaLink } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * The media links of one event, as a participant reads them (FR 3.6, F10).
 *
 * Its own request, like the programme: what the landing page has to answer first
 * is "what is this, when, where". The links arrive sorted — streams, then
 * recordings, then materials (F52) — and the page groups them: the ones with a
 * `programItemId` are rendered with their session.
 *
 * Only asked for when the module is enabled. `media-links` is optional (FR 1.5)
 * and an instance that switched it off answers 404 here (F53), which is a
 * configuration decision rather than an error worth showing anybody.
 */
@Injectable({ providedIn: 'root' })
export class PublicMediaLinksService {
  private readonly api = inject(ApiClient);

  list(
    seriesSlug: string,
    eventSlug: string,
  ): Promise<readonly PublicMediaLink[]> {
    return firstValueFrom(
      this.api.get<PublicMediaLink[]>(
        `user/series/${seriesSlug}/events/${eventSlug}/media-links`,
      ),
    );
  }
}
