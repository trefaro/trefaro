import { Injectable, inject } from '@angular/core';
import type { Translation, TranslocoLoader } from '@jsverse/transloco';
import { ApiClient } from '@trefaro/shared-http';
import type { TranslationCatalogue } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Where a client's text comes from (E22).
 *
 * `GET /api/i18n/:locale`, not a JSON file in this client's own image. Chapter 4
 * asks that an organization be able to add and maintain a language; a file
 * inside the bundle is changed only by rebuilding the image, which is precisely
 * what the organization running the container cannot do. The server answers the
 * shipped catalogue overlaid with the instance's own rows, so a corrected word
 * is live on the next reload.
 *
 * Through {@link ApiClient} rather than `HttpClient` directly, so the base path
 * and the error translation are the same ones every other call uses — and so the
 * request is visible in the same place as all the others when it fails.
 *
 * No caching here. The answer carries an ETag and `no-cache`, which makes the
 * browser's own revalidation the cache: a second start is a 304 with no body,
 * and a changed translation is a 200. A cache in this class would be a second
 * one, and the one that could be wrong.
 */
@Injectable({ providedIn: 'root' })
export class TrefaroCatalogueLoader implements TranslocoLoader {
  private readonly api = inject(ApiClient);

  async getTranslation(locale: string): Promise<Translation> {
    // Typed as the flat catalogue on the way in and widened to Transloco's
    // `Translation` on the way out: the wire type is ours, the shape it is
    // handed to is theirs.
    const catalogue = await firstValueFrom(
      this.api.get<TranslationCatalogue>(`i18n/${encodeURIComponent(locale)}`),
    );
    return { ...catalogue };
  }
}
