import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  ProgramItem,
  ProgramItemChange,
  ProgramItemInput,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * The programme of one event, from the client side (FR 3.7).
 *
 * Stateless: the list endpoint answers with the programme in the order it
 * happens, so the page never has to work out where an edited item now belongs —
 * changing a session's time is what moves it (F40).
 */
@Injectable({ providedIn: 'root' })
export class ProgramAdminService {
  private readonly api = inject(ApiClient);

  list(eventId: string): Promise<readonly ProgramItem[]> {
    return firstValueFrom(
      this.api.get<ProgramItem[]>(`admin/events/${eventId}/program-items`),
    );
  }

  create(eventId: string, input: ProgramItemInput): Promise<ProgramItem> {
    return firstValueFrom(
      this.api.post<ProgramItem>(
        `admin/events/${eventId}/program-items`,
        input,
      ),
    );
  }

  update(id: string, change: ProgramItemChange): Promise<ProgramItem> {
    return firstValueFrom(
      this.api.patch<ProgramItem>(`admin/program-items/${id}`, change),
    );
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`admin/program-items/${id}`));
  }
}
