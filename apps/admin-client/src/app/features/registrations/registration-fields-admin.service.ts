import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  RegistrationField,
  RegistrationFieldChange,
  RegistrationFieldInput,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * The registration form of one event, from the client side (F12, FR 3.5).
 *
 * Stateless: every call answers with the whole form in its new order, so the
 * page it serves never has to reconstruct what the server just did.
 */
@Injectable({ providedIn: 'root' })
export class RegistrationFieldsAdminService {
  private readonly api = inject(ApiClient);

  list(eventId: string): Promise<readonly RegistrationField[]> {
    return firstValueFrom(
      this.api.get<RegistrationField[]>(
        `admin/events/${eventId}/registration-fields`,
      ),
    );
  }

  create(
    eventId: string,
    input: RegistrationFieldInput,
  ): Promise<RegistrationField> {
    return firstValueFrom(
      this.api.post<RegistrationField>(
        `admin/events/${eventId}/registration-fields`,
        input,
      ),
    );
  }

  update(
    id: string,
    change: RegistrationFieldChange,
  ): Promise<RegistrationField> {
    return firstValueFrom(
      this.api.patch<RegistrationField>(
        `admin/registration-fields/${id}`,
        change,
      ),
    );
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(
      this.api.delete<void>(`admin/registration-fields/${id}`),
    );
  }

  /** The complete list of ids in their new order — never a single move. */
  reorder(
    eventId: string,
    ids: readonly string[],
  ): Promise<readonly RegistrationField[]> {
    return firstValueFrom(
      this.api.put<RegistrationField[]>(
        `admin/events/${eventId}/registration-fields/order`,
        { ids },
      ),
    );
  }
}
