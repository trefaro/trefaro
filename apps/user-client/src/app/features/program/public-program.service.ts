import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type { PublicProgramItem } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * The programme as a participant reads it (FR 3.6, FR 3.7).
 *
 * No authentication involved, like the landing page it belongs to: the programme
 * is part of what somebody has to be able to read before deciding whether to
 * come.
 *
 * Its own request rather than part of the event: the landing page renders the
 * event first and fills the timeline in when it arrives, so a long programme
 * never delays the answer to "what is this and when".
 */
@Injectable({ providedIn: 'root' })
export class PublicProgramService {
  private readonly api = inject(ApiClient);

  list(
    seriesSlug: string,
    eventSlug: string,
  ): Promise<readonly PublicProgramItem[]> {
    return firstValueFrom(
      this.api.get<PublicProgramItem[]>(
        `user/series/${encodeURIComponent(seriesSlug)}/events/${encodeURIComponent(
          eventSlug,
        )}/program`,
      ),
    );
  }
}
