import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type { PublicEvent } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Events as a participant sees them (FR 2.3, FR 3.6).
 *
 * No authentication involved: the landing page is what a shared link points at,
 * and it has to work for someone who has never registered for anything.
 */
@Injectable({ providedIn: 'root' })
export class PublicEventsService {
  private readonly api = inject(ApiClient);

  listBySeries(seriesSlug: string): Promise<readonly PublicEvent[]> {
    return firstValueFrom(
      this.api.get<PublicEvent[]>(
        `user/series/${encodeURIComponent(seriesSlug)}/events`,
      ),
    );
  }

  get(seriesSlug: string, eventSlug: string): Promise<PublicEvent> {
    return firstValueFrom(
      this.api.get<PublicEvent>(
        `user/series/${encodeURIComponent(seriesSlug)}/events/${encodeURIComponent(eventSlug)}`,
      ),
    );
  }
}
