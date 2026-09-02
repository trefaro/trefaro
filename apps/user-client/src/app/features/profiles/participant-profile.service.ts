import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import {
  BRANDING_IMAGE_PART,
  type AvatarImage,
  type ParticipantAccount,
  type ParticipantPasswordChange,
  type ParticipantProfileUpdate,
  type ProfileFieldPublic,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * The participant's own profile, from the client side (FR 4.3).
 *
 * Four writes, and each is its own request for a reason the endpoints already
 * carry: the form saves with `PATCH`, the password needs the old one and must
 * not ride along with a name correction, and the picture is written the moment
 * it is sent (F116) rather than when the form is saved.
 */
@Injectable({ providedIn: 'root' })
export class ParticipantProfileService {
  private readonly api = inject(ApiClient);

  /**
   * The questions this instance asks in its profile form (E35).
   *
   * Read on every visit, so a question an organizer added a minute ago is
   * asked now — the same freshness rule the registration form follows.
   */
  fields(): Promise<readonly ProfileFieldPublic[]> {
    return firstValueFrom(
      this.api.get<ProfileFieldPublic[]>('participant/profile-fields'),
    );
  }

  /** @throws ApiError — 400 for an unknown question or a missing required answer. */
  update(change: ParticipantProfileUpdate): Promise<ParticipantAccount> {
    return firstValueFrom(
      this.api.patch<ParticipantAccount>('participant/me', change),
    );
  }

  /** @throws ApiError — 401 when the current password is not right. */
  changePassword(change: ParticipantPasswordChange): Promise<void> {
    return firstValueFrom(
      this.api.put<void>('participant/me/password', change),
    );
  }

  uploadAvatar(file: File): Promise<AvatarImage> {
    const body = new FormData();
    body.append(BRANDING_IMAGE_PART, file, file.name);
    return firstValueFrom(
      this.api.put<AvatarImage>('participant/me/avatar', body),
    );
  }

  removeAvatar(): Promise<AvatarImage> {
    return firstValueFrom(
      this.api.delete<AvatarImage>('participant/me/avatar'),
    );
  }
}
