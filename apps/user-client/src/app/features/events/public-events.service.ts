import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type { PublicEvent } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Events as a participant sees them (FR 2.3, FR 3.6).
 *
 * No authentication involved: the landing page is what a shared link points at,
 * and it has to work for someone who has never registered for anything.
 *
 * The reader's language travels in the query (FR 3.12, E25). Passed in rather
 * than read from the translation service here: a page has to re-fetch when the
 * language changes anyway, so the language it fetched with belongs where that
 * decision is made — and this service stays testable without a catalogue.
 */
@Injectable({ providedIn: 'root' })
export class PublicEventsService {
  private readonly api = inject(ApiClient);

  listBySeries(
    seriesSlug: string,
    locale: string,
  ): Promise<readonly PublicEvent[]> {
    return firstValueFrom(
      this.api.get<PublicEvent[]>(
        `user/series/${encodeURIComponent(seriesSlug)}/events`,
        { locale },
      ),
    );
  }

  get(
    seriesSlug: string,
    eventSlug: string,
    locale: string,
  ): Promise<PublicEvent> {
    return firstValueFrom(
      this.api.get<PublicEvent>(
        `user/series/${encodeURIComponent(seriesSlug)}/events/${encodeURIComponent(eventSlug)}`,
        { locale },
      ),
    );
  }
}
