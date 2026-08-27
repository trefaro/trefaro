import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  RegistrationAcknowledgement,
  RegistrationConfirmation,
  RegistrationFieldPublic,
  RegistrationInput,
} from '@trefaro/shared-models';
import { REGISTRATION_PAYLOAD_PART } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/** One file the participant picked, and the field that asked for it. */
export interface RegistrationFileAnswer {
  readonly fieldKey: string;
  readonly file: File;
}

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

  /**
   * Submits the form — as JSON, or as multipart if a file was picked.
   *
   * One request either way (E9). A form without a file field sends what it
   * always sent; a form with one puts the same JSON into the
   * `REGISTRATION_PAYLOAD_PART` part and each file into a part named after its
   * field key, because multipart cannot express a nested object.
   */
  register(
    seriesSlug: string,
    eventSlug: string,
    input: RegistrationInput,
    files: readonly RegistrationFileAnswer[] = [],
  ): Promise<RegistrationAcknowledgement> {
    const path = `user/series/${encodeURIComponent(seriesSlug)}/events/${encodeURIComponent(eventSlug)}/registrations`;
    return firstValueFrom(
      this.api.post<RegistrationAcknowledgement>(
        path,
        files.length === 0 ? input : toMultipart(input, files),
      ),
    );
  }

  /**
   * The extra questions this event's form asks (F12).
   *
   * Its own request rather than part of the event: only the form needs them, and
   * the landing page would carry them for nothing.
   */
  fields(
    seriesSlug: string,
    eventSlug: string,
  ): Promise<readonly RegistrationFieldPublic[]> {
    return firstValueFrom(
      this.api.get<RegistrationFieldPublic[]>(
        `user/series/${encodeURIComponent(seriesSlug)}/events/${encodeURIComponent(eventSlug)}/registration-fields`,
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

function toMultipart(
  input: RegistrationInput,
  files: readonly RegistrationFileAnswer[],
): FormData {
  const form = new FormData();
  form.append(REGISTRATION_PAYLOAD_PART, JSON.stringify(input));
  for (const { fieldKey, file } of files) {
    form.append(fieldKey, file, file.name);
  }
  return form;
}
