import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  ContactQuery,
  Invitation,
  InvitationInput,
  InvitationPage,
  InvitationQuery,
  SeriesContactPage,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Inviting former participants of a series, from the client side (FR 2.4).
 *
 * Stateless, like the other feature services. One thing about it is unusual and
 * worth knowing before reading the page: {@link send} answers as soon as the
 * recipients are recorded, *not* when the mails are out (F56). The invitation it
 * returns says `sending`; the page polls {@link get} until it does not.
 */
@Injectable({ providedIn: 'root' })
export class InvitationsAdminService {
  private readonly api = inject(ApiClient);

  /** The addresses this series may write to — never a list to type into (F55). */
  contacts(seriesId: string, query: ContactQuery): Promise<SeriesContactPage> {
    return firstValueFrom(
      this.api.get<SeriesContactPage>(`admin/series/${seriesId}/contacts`, {
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
      }),
    );
  }

  list(seriesId: string, query: InvitationQuery): Promise<InvitationPage> {
    return firstValueFrom(
      this.api.get<InvitationPage>(`admin/series/${seriesId}/invitations`, {
        page: query.page,
        pageSize: query.pageSize,
      }),
    );
  }

  /** Accepted, not sent: the mails follow one at a time (F56). */
  send(seriesId: string, input: InvitationInput): Promise<Invitation> {
    return firstValueFrom(
      this.api.post<Invitation>(`admin/series/${seriesId}/invitations`, input),
    );
  }

  get(id: string): Promise<Invitation> {
    return firstValueFrom(this.api.get<Invitation>(`admin/invitations/${id}`));
  }
}
