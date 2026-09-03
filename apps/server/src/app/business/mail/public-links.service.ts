import { Inject, Injectable } from '@nestjs/common';
import { publicEventPath, publicUrl } from '@trefaro/shared-models';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';

/**
 * Absolute links into the clients, for mail.
 *
 * Every address in a message has to be absolute — it is read in a mail client,
 * not in the app — and every one of them is built from the same configured
 * origin. One place, because three modules now need it (registration,
 * participants and invitations) and three copies of
 * `env.publicUserClientUrl.replace(…)` would be three chances for one of them
 * to keep a trailing slash and produce `//registrations/confirm`.
 *
 * Lives in the mail module rather than in a utility: composing a link into the
 * participant client is only ever done for a message that leaves the instance.
 */
@Injectable()
export class PublicLinks {
  private readonly origin: string;
  private readonly adminOrigin: string;

  constructor(@Inject(ENV) env: TrefaroEnv) {
    this.origin = env.publicUserClientUrl;
    this.adminOrigin = env.publicAdminClientUrl;
  }

  url(path: string): string {
    return publicUrl(this.origin, path);
  }

  /**
   * A page of the **organizer** client (FR 3.4).
   *
   * The second origin, and the only mail that needs it is the one that goes to
   * the organization rather than to a participant: a contact request is read
   * and answered where the organization works. Built through the same
   * `publicUrl` for the same reason the other one is — the two settings are
   * configured by hand, and exactly one of them will end with a slash.
   */
  adminUrl(path: string): string {
    return publicUrl(this.adminOrigin, path);
  }

  /** The public landing page of an event (E7, F28). */
  event(seriesSlug: string, eventSlug: string): string {
    return this.url(publicEventPath(seriesSlug, eventSlug));
  }

  /**
   * A page that a signed token authorizes.
   *
   * The token travels in the query string because the link is opened by a
   * browser; what the page then does with it is a POST (E5b, F44).
   */
  token(path: string, token: string): string {
    return `${this.url(path)}?token=${encodeURIComponent(token)}`;
  }
}
