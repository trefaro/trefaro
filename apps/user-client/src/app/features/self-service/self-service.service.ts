import { Injectable, inject } from '@angular/core';
import { ApiClient } from '@trefaro/shared-http';
import type {
  MyRegistration,
  MyRegistrationPage,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Which credential a request to "my registration" carries (E11, E31).
 *
 * The **link** from the confirmation receipt is what phase 1 shipped and it
 * keeps working — that was the promise. The **session** is the way phase 3
 * adds: the same operations, under `participant/`, with the cookie doing what
 * the token did. One type so the page holds one value and every call takes it,
 * rather than a boolean and two branches per button.
 */
export type SelfServiceAccess =
  | { readonly kind: 'link'; readonly token: string }
  | { readonly kind: 'session'; readonly registrationId: string };

export const byLink = (token: string): SelfServiceAccess => ({
  kind: 'link',
  token,
});

export const bySession = (registrationId: string): SelfServiceAccess => ({
  kind: 'session',
  registrationId,
});

/**
 * The participant's own registration, over a link or over a session (E11).
 *
 * The token travels in the query for the read — that is what the link in the
 * mail does — and in the body for everything that changes something, so a link
 * previewer fetching URLs cannot claim a seat or cancel a registration (the
 * reasoning of E5b). The session sends nothing of the sort: the cookie is the
 * credential and the path is the guard (E33).
 *
 * Every call answers with the whole view. A seat can be taken between rendering
 * the page and pressing a button, so the page that just claimed the last one
 * has to be able to say what is left.
 *
 * And because every call answers with the whole view, every call carries the
 * reader's language (FR 3.12) — in the query even where a token is in the body.
 * A language is not a secret, and a page that fell back to English the moment
 * somebody claimed a seat would change language when it is used.
 */
@Injectable({ providedIn: 'root' })
export class SelfServiceService {
  private readonly api = inject(ApiClient);

  /** Every registration of the logged-in participant, newest event first. */
  listMine(locale: string, page = 1): Promise<MyRegistrationPage> {
    return firstValueFrom(
      this.api.get<MyRegistrationPage>('participant/registrations', {
        locale,
        page,
      }),
    );
  }

  view(access: SelfServiceAccess, locale: string): Promise<MyRegistration> {
    return firstValueFrom(
      access.kind === 'link'
        ? this.api.get<MyRegistration>('user/registrations/me', {
            token: access.token,
            locale,
          })
        : this.api.get<MyRegistration>(
            `participant/registrations/${encodeURIComponent(access.registrationId)}`,
            { locale },
          ),
    );
  }

  signUp(
    itemId: string,
    access: SelfServiceAccess,
    locale: string,
  ): Promise<MyRegistration> {
    return firstValueFrom(
      access.kind === 'link'
        ? this.api.put<MyRegistration>(
            `user/program-items/${encodeURIComponent(itemId)}/signup`,
            { token: access.token },
            { locale },
          )
        : this.api.put<MyRegistration>(
            this.seatPath(access, itemId),
            {},
            {
              locale,
            },
          ),
    );
  }

  signOff(
    itemId: string,
    access: SelfServiceAccess,
    locale: string,
  ): Promise<MyRegistration> {
    return firstValueFrom(
      access.kind === 'link'
        ? this.api.delete<MyRegistration>(
            `user/program-items/${encodeURIComponent(itemId)}/signup`,
            { token: access.token },
            { locale },
          )
        : this.api.delete<MyRegistration>(
            this.seatPath(access, itemId),
            undefined,
            { locale },
          ),
    );
  }

  /**
   * Cancels the registration; the record stays, the seats do not (E11, E14).
   *
   * Only over a link. The rule itself has no second way yet: the session's
   * route to it is AP 12, with the rest of FR 4.7 — so a page opened through
   * the account does not offer the button rather than offering one that cannot
   * work.
   */
  cancel(token: string, locale: string): Promise<MyRegistration> {
    return firstValueFrom(
      this.api.post<MyRegistration>(
        'user/registrations/me/cancellation',
        { token },
        undefined,
        { locale },
      ),
    );
  }

  private seatPath(
    access: { readonly registrationId: string },
    itemId: string,
  ): string {
    return (
      `participant/registrations/${encodeURIComponent(access.registrationId)}` +
      `/program-items/${encodeURIComponent(itemId)}/signup`
    );
  }
}
