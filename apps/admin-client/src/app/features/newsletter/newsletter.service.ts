import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type { NewsletterAudiencePage } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * The newsletter opt-in administration, as the organizer client reads it
 * (FR 4.8, E45).
 *
 * Two calls, and the ones that are missing are the point: there is no way to
 * add an address and no way to send anything. A consent is given by the person
 * behind the address and by nobody else, and v1 sends no newsletter (F8) — an
 * organization exports this list into the tool it already sends with.
 */
@Injectable({ providedIn: 'root' })
export class NewsletterAudienceService {
  private readonly api = inject(ApiClient);

  page(locale: string, page = 1): Promise<NewsletterAudiencePage> {
    return firstValueFrom(
      this.api.get<NewsletterAudiencePage>('admin/newsletter', {
        locale,
        page,
      }),
    );
  }

  /** Takes one sign-up back — only the app source has an id (E45). */
  remove(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`admin/newsletter/${id}`));
  }
}
