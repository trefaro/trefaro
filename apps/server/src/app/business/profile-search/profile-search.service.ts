import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_PROFILE_SEARCH_PAGE_SIZE,
  MAX_PROFILE_SEARCH_PAGE_SIZE,
  type ProfileSearchHit,
  type ProfileSearchPage,
  type ProfileSearchQuery,
  type PublicProfile,
} from '@trefaro/shared-models';
import { pageWindow } from '../common/page-window';
import { searchTerms } from '../common/search-terms';
import { avatarUrl } from '../profiles';
import {
  SEARCHABLE_PROFILE_REPOSITORY,
  type SearchableProfileRecord,
  type SearchableProfileRepository,
} from '../common/ports/searchable-profile.repository';

/**
 * What every unanswerable request about a profile says.
 *
 * One sentence for three states — no such id, an unconfirmed account, a profile
 * that did not opt in — because the difference is exactly what a reader must
 * not learn. Whoever holds an id holds the avatar with it (F124), so an id that
 * can be confirmed to exist is an id worth guessing at.
 */
const NOT_VISIBLE = 'No profile of that id is in the participant search.';

/**
 * Finding other participants (FR 4.4, UC 12 — E37).
 *
 * The community half of the thesis: people who met at an event can find each
 * other again, across events and across series, and that is the point. What
 * keeps it from being a directory of activists is that every row is somebody's
 * own decision — `searchable` is off until its owner switches it on, and it is
 * the same switch that allows being written to (E37, F13). This service never
 * checks that flag: the port cannot answer with a profile that lacks it, which
 * is one place instead of one per caller.
 *
 * Two shapes leave here. A **row** is what gets somebody to a profile — name,
 * picture, field of activity — and a **profile** additionally carries the
 * answers to this instance's questions (E35). Neither carries an address: a
 * participant reaches another participant through a conversation (FR 4.5), and
 * a search that handed out mailboxes would be an export of the community (F55).
 */
@Injectable()
export class ProfileSearchService {
  constructor(
    @Inject(SEARCHABLE_PROFILE_REPOSITORY)
    private readonly profiles: SearchableProfileRepository,
  ) {}

  /**
   * One page of the search, filtered, sorted and counted in SQL.
   *
   * The reader is left out in the query rather than dropped from the answer: a
   * row removed after the window would make a page of twenty nineteen and the
   * total one too many.
   *
   * Both boxes may be empty, and then this is a directory being browsed. That
   * is deliberate — a search that answers nothing until it is asked something
   * hides a community from the people in it, and everybody in the answer put
   * themselves there.
   */
  async search(
    viewerId: string,
    query: ProfileSearchQuery,
  ): Promise<ProfileSearchPage> {
    const { page, pageSize, offset } = pageWindow(
      query,
      DEFAULT_PROFILE_SEARCH_PAGE_SIZE,
      MAX_PROFILE_SEARCH_PAGE_SIZE,
    );

    const slice = await this.profiles.search({
      terms: searchTerms(query.search),
      activityTerms: searchTerms(query.activityAreas),
      excludeId: viewerId,
      offset,
      limit: pageSize,
    });

    return {
      rows: slice.rows.map(toHit),
      total: slice.total,
      // What was used, not what was asked for: a client that asked for a
      // thousand has to be able to tell that it got fifty.
      page,
      pageSize,
    };
  }

  /**
   * One profile, as far as it shows itself.
   *
   * No exception for the reader's own id. The rule is about the profile, not
   * about who is asking — somebody who opted in can open their own entry, and
   * somebody who did not gets the same answer as everybody else. Skipping
   * oneself belongs to the list, where searching for oneself is noise.
   *
   * @throws NotFoundException — unknown, unconfirmed or not opted in, and the
   * three are indistinguishable from the outside.
   */
  async get(id: string): Promise<PublicProfile> {
    const profile = await this.profiles.findVisible(id);
    if (!profile) throw new NotFoundException(NOT_VISIBLE);
    return { ...toHit(profile), customFields: profile.customFields };
  }
}

/** A row of the list: no stored path, no answers, no address. */
function toHit(profile: SearchableProfileRecord): ProfileSearchHit {
  return {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    // The route that resolves the file, versioned by the row's own timestamp
    // (F124) — the stored path never leaves the server.
    avatarUrl: avatarUrl(profile.id, profile.avatarPath, profile.updatedAt),
    activityAreas: profile.activityAreas,
  };
}
