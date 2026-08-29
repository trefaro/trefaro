import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  LocaleCatalogueDetail,
  LocaleOverview,
  TranslationWriteResult,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * The language administration, from the client side (chapter 4, AP 7).
 *
 * Reads from `/api/admin/i18n`, not from the public `/api/i18n/:locale` this
 * client's own text comes from. The public endpoint answers one resolved
 * catalogue — exactly what should be rendered, with every gap already filled
 * from English. A screen whose job is finding the gaps cannot be built from it:
 * it needs to know which text came from the image, which the organization wrote,
 * and which is missing.
 *
 * Stateless. The page re-reads after every write, because the server decides
 * what a write meant: an empty value resets a key, and a value equal to the
 * shipped text stores no row at all.
 */
@Injectable({ providedIn: 'root' })
export class TranslationsAdminService {
  private readonly api = inject(ApiClient);

  /** Every language this instance knows, with its completeness figure. */
  overview(): Promise<LocaleOverview> {
    return firstValueFrom(this.api.get<LocaleOverview>('admin/i18n'));
  }

  /** One language, key by key — answers for an unknown tag as well (E30). */
  detail(locale: string): Promise<LocaleCatalogueDetail> {
    return firstValueFrom(
      this.api.get<LocaleCatalogueDetail>(
        `admin/i18n/${encodeURIComponent(locale)}`,
      ),
    );
  }

  /**
   * Writes one key or a whole imported file — the same endpoint either way.
   *
   * A merge: keys that are absent stay as they were. So a single edit sends one
   * entry, and an import sends the file it was given.
   */
  write(
    locale: string,
    entries: Readonly<Record<string, string>>,
  ): Promise<TranslationWriteResult> {
    return firstValueFrom(
      this.api.put<TranslationWriteResult>(
        `admin/i18n/${encodeURIComponent(locale)}`,
        { entries },
      ),
    );
  }

  /**
   * Drops the organization's own text for one key.
   *
   * The key goes into the path encoded: it contains dots, which are safe in a
   * path segment, and encoding it is what makes that a property of the code
   * rather than of the key convention.
   */
  reset(locale: string, key: string): Promise<TranslationWriteResult> {
    return firstValueFrom(
      this.api.delete<TranslationWriteResult>(
        `admin/i18n/${encodeURIComponent(locale)}/${encodeURIComponent(key)}`,
      ),
    );
  }
}
