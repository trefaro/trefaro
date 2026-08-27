import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type { PublicEventSeries } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Event series as a participant sees them (FR 2.3).
 *
 * No authentication involved: the start page is public, which is the low entry
 * barrier the thesis asks for.
 */
@Injectable({ providedIn: 'root' })
export class PublicEventSeriesService {
  private readonly api = inject(ApiClient);

  list(): Promise<readonly PublicEventSeries[]> {
    return firstValueFrom(this.api.get<PublicEventSeries[]>('user/series'));
  }

  bySlug(slug: string): Promise<PublicEventSeries> {
    return firstValueFrom(
      this.api.get<PublicEventSeries>(
        `user/series/${encodeURIComponent(slug)}`,
      ),
    );
  }
}
