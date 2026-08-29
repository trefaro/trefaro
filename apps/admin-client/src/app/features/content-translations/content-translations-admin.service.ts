import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  EventSeriesTranslation,
  EventSeriesTranslations,
  EventTranslation,
  EventTranslations,
  ProgramItemTranslation,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Translating the content an organization writes (FR 3.12, UC 12).
 *
 * Reading is one request per screen and writing is one request per thing and
 * language — the shape the API has, and the shape the editor wants: a translator
 * saves the session they just finished, and a mistake in the nineteenth session
 * must not throw away the third.
 */
@Injectable({ providedIn: 'root' })
export class ContentTranslationsAdminService {
  private readonly api = inject(ApiClient);

  series(id: string): Promise<EventSeriesTranslations> {
    return firstValueFrom(
      this.api.get<EventSeriesTranslations>(
        `admin/series/${encodeURIComponent(id)}/translations`,
      ),
    );
  }

  event(id: string): Promise<EventTranslations> {
    return firstValueFrom(
      this.api.get<EventTranslations>(
        `admin/events/${encodeURIComponent(id)}/translations`,
      ),
    );
  }

  writeSeries(
    id: string,
    locale: string,
    value: EventSeriesTranslation,
  ): Promise<EventSeriesTranslation> {
    return this.write(`admin/series/${encodeURIComponent(id)}`, locale, value);
  }

  writeEvent(
    id: string,
    locale: string,
    value: EventTranslation,
  ): Promise<EventTranslation> {
    return this.write(`admin/events/${encodeURIComponent(id)}`, locale, value);
  }

  writeProgramItem(
    id: string,
    locale: string,
    value: ProgramItemTranslation,
  ): Promise<ProgramItemTranslation> {
    return this.write(
      `admin/program-items/${encodeURIComponent(id)}`,
      locale,
      value,
    );
  }

  removeSeries(id: string, locale: string): Promise<void> {
    return this.erase(`admin/series/${encodeURIComponent(id)}`, locale);
  }

  removeEvent(id: string, locale: string): Promise<void> {
    return this.erase(`admin/events/${encodeURIComponent(id)}`, locale);
  }

  removeProgramItem(id: string, locale: string): Promise<void> {
    return this.erase(`admin/program-items/${encodeURIComponent(id)}`, locale);
  }

  private write<T>(parent: string, locale: string, value: T): Promise<T> {
    return firstValueFrom(
      this.api.put<T>(
        `${parent}/translations/${encodeURIComponent(locale)}`,
        value,
      ),
    );
  }

  private erase(parent: string, locale: string): Promise<void> {
    return firstValueFrom(
      this.api.delete<void>(
        `${parent}/translations/${encodeURIComponent(locale)}`,
      ),
    );
  }
}
