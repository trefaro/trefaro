import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  RegistrationAcknowledgement,
  RegistrationConfirmation,
  RegistrationInput,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Registering for an event and confirming it (FR 3.5).
 *
 * Both calls are POSTs and neither carries a credential: phase 1 has no
 * participant login, and the address is verified by the mailed link instead of
 * by an account (E5b).
 */
@Injectable({ providedIn: 'root' })
export class RegistrationsService {
  private readonly api = inject(ApiClient);

  register(
    seriesSlug: string,
    eventSlug: string,
    input: RegistrationInput,
  ): Promise<RegistrationAcknowledgement> {
    return firstValueFrom(
      this.api.post<RegistrationAcknowledgement>(
        `user/series/${encodeURIComponent(seriesSlug)}/events/${encodeURIComponent(eventSlug)}/registrations`,
        input,
      ),
    );
  }

  confirm(token: string): Promise<RegistrationConfirmation> {
    return firstValueFrom(
      this.api.post<RegistrationConfirmation>('user/registrations/confirm', {
        token,
      }),
    );
  }
}
