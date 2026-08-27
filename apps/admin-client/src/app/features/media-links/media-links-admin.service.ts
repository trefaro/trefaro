import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  MediaLink,
  MediaLinkChange,
  MediaLinkInput,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * The media links of one event, from the client side (FR 3.6, F10).
 *
 * Stateless, like the programme service: the list endpoint answers in the order
 * the links are shown, so the page never has to work out where an edited link
 * now belongs — its kind decides that (F52).
 *
 * Every call here can answer 404 for a reason that is not "gone": `media-links`
 * is an optional core module, and an instance that switched it off answers 404
 * on all of these (F53). The page therefore asks the configuration whether the
 * module is on before offering the editor at all.
 */
@Injectable({ providedIn: 'root' })
export class MediaLinksAdminService {
  private readonly api = inject(ApiClient);

  list(eventId: string): Promise<readonly MediaLink[]> {
    return firstValueFrom(
      this.api.get<MediaLink[]>(`admin/events/${eventId}/media-links`),
    );
  }

  create(eventId: string, input: MediaLinkInput): Promise<MediaLink> {
    return firstValueFrom(
      this.api.post<MediaLink>(`admin/events/${eventId}/media-links`, input),
    );
  }

  update(id: string, change: MediaLinkChange): Promise<MediaLink> {
    return firstValueFrom(
      this.api.patch<MediaLink>(`admin/media-links/${id}`, change),
    );
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`admin/media-links/${id}`));
  }
}
