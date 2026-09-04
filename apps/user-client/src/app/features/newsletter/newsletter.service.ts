import { Injectable, inject } from '@angular/core';
import { AppConfigService } from '@trefaro/shared-config';
import { ApiClient } from '@trefaro/shared-http';
import type {
  NewsletterConfirmation,
  NewsletterSignupAcknowledgement,
} from '@trefaro/shared-models';
import { NEWSLETTER_MODULE_KEY } from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Signing up for the newsletter, and confirming it (FR 4.8, E45).
 *
 * Both calls are a `POST`, and the second one for the reason every confirmation
 * in this application is one (E5b): the link in the mail opens a page and the
 * page posts here, so a mail scanner that fetches URLs confirms nothing.
 *
 * {@link offered} is what decides whether the form appears at all. It reads the
 * configuration this client fetched at startup — the same state the server's
 * guard reads (F53) — so the form is shown exactly when its endpoint answers.
 * An organization that has no newsletter has this module off, and then there is
 * nothing on either screen: a form that promises news nobody sends would be
 * worse than no form (F42 applied to a screen).
 */
@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private readonly api = inject(ApiClient);
  private readonly config = inject(AppConfigService);

  offered(): boolean {
    return this.config.isModuleEnabled(NEWSLETTER_MODULE_KEY);
  }

  /**
   * Signs an address up — for one series, or for the whole instance.
   *
   * The answer is the address and nothing else, whatever the state of that
   * address already was (E45, E32), so there is nothing here for a caller to
   * branch on. What the screen says next is therefore the same sentence in
   * every case, which is the point.
   */
  signUp(
    email: string,
    seriesSlug?: string,
  ): Promise<NewsletterSignupAcknowledgement> {
    return firstValueFrom(
      this.api.post<NewsletterSignupAcknowledgement>('user/newsletter', {
        email,
        ...(seriesSlug ? { seriesSlug } : {}),
      }),
    );
  }

  confirm(token: string): Promise<NewsletterConfirmation> {
    return firstValueFrom(
      this.api.post<NewsletterConfirmation>('user/newsletter/confirm', {
        token,
      }),
    );
  }
}
