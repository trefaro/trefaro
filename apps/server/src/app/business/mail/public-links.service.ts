import { Inject, Injectable } from '@nestjs/common';
import { publicEventPath, publicUrl } from '@trefaro/shared-models';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';

/**
 * Absolute links into the participant client, for mail.
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

  constructor(@Inject(ENV) env: TrefaroEnv) {
    this.origin = env.publicUserClientUrl;
  }

  url(path: string): string {
    return publicUrl(this.origin, path);
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
