import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type { ContactOptOutResult } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * "Do not invite me again" (FR 2.4, E15).
 *
 * A `POST` although it reads like a link: the token travels in the body so a
 * mail scanner that fetches every URL in a message cannot decide this on the
 * reader's behalf (E5b, F58).
 */
@Injectable({ providedIn: 'root' })
export class InvitationOptOutService {
  private readonly api = inject(ApiClient);

  optOut(token: string): Promise<ContactOptOutResult> {
    return firstValueFrom(
      this.api.post<ContactOptOutResult>('user/invitations/opt-out', { token }),
    );
  }
}
