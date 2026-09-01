import { Injectable, inject, signal } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  EventSeries,
  EventSeriesInput,
  LogoImage,
} from '@trefaro/shared-models';
import { BRANDING_IMAGE_PART } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/** Event series as the organizer manages them (FR 2.1, FR 2.2). */
@Injectable({ providedIn: 'root' })
export class EventSeriesAdminService {
  private readonly api = inject(ApiClient);
  private readonly state = signal<readonly EventSeries[]>([]);
  private readonly loading = signal(false);

  readonly series = this.state.asReadonly();
  readonly isLoading = this.loading.asReadonly();

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      this.state.set(
        await firstValueFrom(this.api.get<EventSeries[]>('admin/series')),
      );
    } finally {
      this.loading.set(false);
    }
  }

  get(id: string): Promise<EventSeries> {
    return firstValueFrom(this.api.get<EventSeries>(`admin/series/${id}`));
  }

  async create(input: EventSeriesInput): Promise<EventSeries> {
    const created = await firstValueFrom(
      this.api.post<EventSeries>('admin/series', input),
    );
    await this.reload();
    return created;
  }

  async update(
    id: string,
    input: Partial<EventSeriesInput>,
  ): Promise<EventSeries> {
    const updated = await firstValueFrom(
      this.api.patch<EventSeries>(`admin/series/${id}`, input),
    );
    await this.reload();
    return updated;
  }

  /**
   * Replaces the logo of one series (FR 2.1).
   *
   * `FormData` with a single part, whose name is part of the contract
   * (`BRANDING_IMAGE_PART`) — the same part the branding uploads use, because
   * the rules for what may be uploaded are the same. The content type is
   * deliberately not set: the browser writes it including the multipart
   * boundary, and a hand-set header loses the boundary.
   *
   * Written immediately, not on the next save of the form: the answer is the new
   * URL, and the form redraws from it.
   */
  uploadLogo(id: string, file: File): Promise<LogoImage> {
    const body = new FormData();
    body.append(BRANDING_IMAGE_PART, file, file.name);
    return firstValueFrom(
      this.api.put<LogoImage>(`admin/series/${id}/logo`, body),
    );
  }

  removeLogo(id: string): Promise<LogoImage> {
    return firstValueFrom(
      this.api.delete<LogoImage>(`admin/series/${id}/logo`),
    );
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.api.delete<void>(`admin/series/${id}`));
    await this.reload();
  }
}
