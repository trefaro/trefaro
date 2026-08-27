import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  ParticipantDetail,
  ParticipantPage,
  ParticipantQuery,
  ParticipantRow,
  RegistrationStatistics,
  RegistrationStatus,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * The participant overview, from the client side (FR 3.3).
 *
 * Stateless, and without a cache on purpose: the page it serves is a filtered,
 * sorted window onto a table that other organizers are changing at the same
 * time. A cached page would be the wrong answer to the question the organizer
 * just asked.
 */
@Injectable({ providedIn: 'root' })
export class ParticipantsAdminService {
  private readonly api = inject(ApiClient);

  list(eventId: string, query: ParticipantQuery): Promise<ParticipantPage> {
    return firstValueFrom(
      this.api.get<ParticipantPage>(`admin/events/${eventId}/registrations`, {
        search: query.search,
        status: query.status,
        sort: query.sort,
        direction: query.direction,
        page: query.page,
        pageSize: query.pageSize,
      }),
    );
  }

  statistics(eventId: string): Promise<RegistrationStatistics> {
    return firstValueFrom(
      this.api.get<RegistrationStatistics>(
        `admin/events/${eventId}/registrations/statistics`,
      ),
    );
  }

  get(id: string): Promise<ParticipantDetail> {
    return firstValueFrom(
      this.api.get<ParticipantDetail>(`admin/registrations/${id}`),
    );
  }

  /** Cancels, or reinstates a cancelled registration (E14). */
  setStatus(id: string, status: RegistrationStatus): Promise<ParticipantRow> {
    return firstValueFrom(
      this.api.patch<ParticipantRow>(`admin/registrations/${id}`, { status }),
    );
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`admin/registrations/${id}`));
  }
}
