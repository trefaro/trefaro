import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type { MyRegistration } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * The participant's own registration, over the signed link (E11).
 *
 * No session and no account: phase 1 has no participant login, and the token
 * from the confirmation mail is what speaks for the registration. It travels in
 * the query for the read — that is what the link in the mail does — and in the
 * body for everything that changes something, so a link previewer fetching URLs
 * cannot claim a seat or cancel a registration (the reasoning of E5b).
 *
 * Every call answers with the whole view. A seat can be taken between rendering
 * the page and pressing a button, so the page that just claimed the last one has
 * to be able to say what is left.
 */
@Injectable({ providedIn: 'root' })
export class SelfServiceService {
  private readonly api = inject(ApiClient);

  view(token: string): Promise<MyRegistration> {
    return firstValueFrom(
      this.api.get<MyRegistration>('user/registrations/me', { token }),
    );
  }

  signUp(itemId: string, token: string): Promise<MyRegistration> {
    return firstValueFrom(
      this.api.put<MyRegistration>(
        `user/program-items/${encodeURIComponent(itemId)}/signup`,
        { token },
      ),
    );
  }

  signOff(itemId: string, token: string): Promise<MyRegistration> {
    return firstValueFrom(
      this.api.delete<MyRegistration>(
        `user/program-items/${encodeURIComponent(itemId)}/signup`,
        { token },
      ),
    );
  }

  /** Cancels the registration; the record stays, the seats do not (E11, E14). */
  cancel(token: string): Promise<MyRegistration> {
    return firstValueFrom(
      this.api.post<MyRegistration>('user/registrations/me/cancellation', {
        token,
      }),
    );
  }
}
