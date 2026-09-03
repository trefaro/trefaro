import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  ContactRequestAcknowledgement,
  ContactRequestInput,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Writing to the organizers without an account (FR 3.4, UC 14, F11).
 *
 * One call, no credential, and none possible: the contact form is on a public
 * landing page, which is the point — somebody who has just found the
 * organization has to be able to ask a question without creating an account,
 * and the answer comes to their inbox rather than to a screen here.
 *
 * Not part of `features/chat/`, although the server stores the request as a
 * conversation. What a client sees are two different things: the chat needs a
 * session and the `chat` module, and this needs neither — an instance with no
 * participant accounts still has a contact form, so a service that sat behind
 * that module's guard would be wrong in the one configuration this endpoint
 * exists for.
 */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly api = inject(ApiClient);

  /**
   * Sends one question about one event.
   *
   * The answer repeats the address and says nothing else — a known address, an
   * unknown one and one that already has an account are indistinguishable from
   * here (E10), and that is deliberate rather than a thin API.
   */
  send(
    seriesSlug: string,
    eventSlug: string,
    input: ContactRequestInput,
  ): Promise<ContactRequestAcknowledgement> {
    const path = `user/series/${encodeURIComponent(seriesSlug)}/events/${encodeURIComponent(eventSlug)}/contact`;
    return firstValueFrom(
      this.api.post<ContactRequestAcknowledgement>(path, input),
    );
  }
}
