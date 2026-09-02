import { Injectable, inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import { ApiClient } from '@trefaro/shared-http';
import {
  PROFILE_SEARCH_MODULE_KEY,
  type ProfileSearchPage,
  type ProfileSearchQuery,
  type PublicProfile,
} from '@trefaro/shared-models';
import { firstValueFrom } from 'rxjs';

/**
 * Finding other participants, from the client side (FR 4.4, UC 12).
 *
 * Two reads and nothing else — this module writes nothing. The whole query
 * object goes to `ApiClient.get`, which drops the entries that are empty, so
 * the browser's address bar shows what was actually asked for rather than every
 * default spelled out.
 *
 * No language travels with either call: nothing in the answer is translated. A
 * name is a name, the field of activity is what somebody wrote about
 * themselves, and the labels of the profile questions come from the field kit
 * this client already reads for the profile form. Sending `?locale=` here would
 * be a 400 — the endpoint does not declare it, deliberately.
 */
@Injectable({ providedIn: 'root' })
export class ProfileSearchService {
  private readonly api = inject(ApiClient);

  find(query: ProfileSearchQuery): Promise<ProfileSearchPage> {
    return firstValueFrom(
      this.api.get<ProfileSearchPage>('participant/profiles', { ...query }),
    );
  }

  /** @throws ApiError — 404 for a profile that is not in the search. */
  get(id: string): Promise<PublicProfile> {
    return firstValueFrom(
      this.api.get<PublicProfile>(
        `participant/profiles/${encodeURIComponent(id)}`,
      ),
    );
  }
}

/**
 * Keeps the search off an instance that does not run one (F53, E42).
 *
 * Beside `participantSessionGuard` on the route rather than instead of it: the
 * session guard decides whether somebody may see a page, this one decides
 * whether the page exists here at all. An organization that keeps accounts
 * without a community directory switches `profile-search` off, and then these
 * endpoints answer 404 — a screen that showed a failed search instead would
 * blame the network for a decision the organization made.
 *
 * The navigation hides the entry for the same reason. This guard is for the
 * bookmark that outlives the switch.
 */
export const profileSearchGuard: CanActivateFn = () => {
  const config = inject(AppConfigService);
  const router = inject(Router);

  return config.isModuleEnabled(PROFILE_SEARCH_MODULE_KEY)
    ? true
    : router.createUrlTree(['/']);
};
