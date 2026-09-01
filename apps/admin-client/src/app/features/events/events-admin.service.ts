import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  EventDashboard,
  EventInput,
  LogoImage,
  OrganizerEvent,
} from '@trefaro/shared-models';
import { BRANDING_IMAGE_PART } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Events as the organizer manages them (FR 3.1, FR 3.2).
 *
 * Stateless, unlike the series service: events are always read for one series
 * or one id, so a cached list would only ever be right for the page that just
 * asked for it.
 */
@Injectable({ providedIn: 'root' })
export class EventsAdminService {
  private readonly api = inject(ApiClient);

  listBySeries(seriesId: string): Promise<readonly OrganizerEvent[]> {
    return firstValueFrom(
      this.api.get<OrganizerEvent[]>(`admin/series/${seriesId}/events`),
    );
  }

  get(id: string): Promise<OrganizerEvent> {
    return firstValueFrom(this.api.get<OrganizerEvent>(`admin/events/${id}`));
  }

  /**
   * Everything the event dashboard shows, in one request (FR 3.8).
   *
   * One request rather than four, so the tiles do not appear one after another —
   * and so the page never downloads rows in order to count them.
   */
  dashboard(id: string): Promise<EventDashboard> {
    return firstValueFrom(
      this.api.get<EventDashboard>(`admin/events/${id}/dashboard`),
    );
  }

  create(seriesId: string, input: EventInput): Promise<OrganizerEvent> {
    return firstValueFrom(
      this.api.post<OrganizerEvent>(`admin/series/${seriesId}/events`, input),
    );
  }

  update(id: string, input: Partial<EventInput>): Promise<OrganizerEvent> {
    return firstValueFrom(
      this.api.patch<OrganizerEvent>(`admin/events/${id}`, input),
    );
  }

  /**
   * Replaces the logo of one event (FR 3.1).
   *
   * The same shape as `EventSeriesAdminService.uploadLogo` — see there for why
   * the multipart part name is part of the contract and why the content type is
   * left to the browser.
   */
  uploadLogo(id: string, file: File): Promise<LogoImage> {
    const body = new FormData();
    body.append(BRANDING_IMAGE_PART, file, file.name);
    return firstValueFrom(
      this.api.put<LogoImage>(`admin/events/${id}/logo`, body),
    );
  }

  removeLogo(id: string): Promise<LogoImage> {
    return firstValueFrom(
      this.api.delete<LogoImage>(`admin/events/${id}/logo`),
    );
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`admin/events/${id}`));
  }
}
