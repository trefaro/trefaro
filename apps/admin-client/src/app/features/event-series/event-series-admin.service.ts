import { Injectable, inject, signal } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type { EventSeries, EventSeriesInput } from '@trefaro/shared-models';
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

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.api.delete<void>(`admin/series/${id}`));
    await this.reload();
  }
}
