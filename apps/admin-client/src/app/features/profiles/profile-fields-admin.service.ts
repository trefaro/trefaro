import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  ProfileField,
  ProfileFieldChange,
  ProfileFieldInput,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * The instance's profile questions, from the organizer's side (E35, FR 4.3).
 *
 * A flat collection with no parent in the path (F122): the questions are
 * instance-wide, because a profile belongs to a person rather than to an event.
 * The registration form's fields hang under their event for the mirror-image
 * reason.
 *
 * Stateless like its neighbour: every call answers with the whole form in its
 * new order, so the page it serves never has to reconstruct what the server
 * just did.
 */
@Injectable({ providedIn: 'root' })
export class ProfileFieldsAdminService {
  private readonly api = inject(ApiClient);

  list(): Promise<readonly ProfileField[]> {
    return firstValueFrom(this.api.get<ProfileField[]>('admin/profile-fields'));
  }

  create(input: ProfileFieldInput): Promise<ProfileField> {
    return firstValueFrom(
      this.api.post<ProfileField>('admin/profile-fields', input),
    );
  }

  update(id: string, change: ProfileFieldChange): Promise<ProfileField> {
    return firstValueFrom(
      this.api.patch<ProfileField>(`admin/profile-fields/${id}`, change),
    );
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`admin/profile-fields/${id}`));
  }

  /** The complete list of ids in their new order — never a single move. */
  reorder(ids: readonly string[]): Promise<readonly ProfileField[]> {
    return firstValueFrom(
      this.api.put<ProfileField[]>('admin/profile-fields/order', { ids }),
    );
  }
}
