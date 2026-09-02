/**
 * Finding other participants — the search of FR 4.4 (UC 12).
 *
 * Two shapes rather than one, and the difference is the point: a row of the
 * result list gets somebody to a profile, it is not the profile. Answers to the
 * instance's profile questions can be twenty per person, and a page of twenty
 * rows would carry four hundred of them to draw a list of names.
 *
 * What is deliberately in neither shape is the **address**. A participant may
 * find another participant and write to them (E37), and the writing happens in
 * a conversation (FR 4.5) — over the profile id, never over a mailbox. The one
 * screen in this application that shows addresses is the organizer's
 * participant overview, which is a correction from the usability test of the
 * thesis and belongs to the person who runs the event; a community search that
 * handed out addresses would be an export of the community (F55).
 */

import type { CustomFieldValues } from '../registrations';

/**
 * The participant search's module key (FR 1.5, E42).
 *
 * Its own switch rather than a part of `profiles`, because the two answer
 * different questions: `profiles` is "does this instance keep accounts at all",
 * `profile-search` is "may the people in it find each other". An organization
 * that wants registrations tied to accounts but no community directory switches
 * this one off and keeps the other on.
 *
 * It **requires** `profiles` (E42): there is nothing to search without
 * accounts. The prerequisite is declared by the descriptor and enforced by the
 * module administration, which refuses to switch this on while `profiles` is
 * off — and refuses to switch `profiles` off while this is on.
 */
export const PROFILE_SEARCH_MODULE_KEY = 'profile-search';

/**
 * One hit of the participant search.
 *
 * Everything a row needs and nothing more: the name to read, the picture to
 * recognise, the field of activity that was searched on, and the id that opens
 * the profile. The id is safe to hand out **because** the row is only ever
 * built for a profile that opted in — whoever gets an id gets the avatar with
 * it (F124), which is why the search must never name a profile it does not
 * show.
 */
export interface ProfileSearchHit {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  /** Carries no stored path and a `?v=` that moves with the picture (F124). */
  readonly avatarUrl: string | null;
  readonly activityAreas: string | null;
}

/**
 * A profile as another participant sees it.
 *
 * The hit plus the answers this person gave to the instance's profile
 * questions (E35) — which is what makes a directory a profile rather than a
 * list of names. The answers arrive by field key; the labels come from
 * `GET /api/participant/profile-fields`, the same definitions the profile form
 * is drawn from, so a question and its answer cannot be labelled differently
 * on the two screens.
 *
 * Answers to questions that have since been deleted travel too — deleting a
 * question does not delete what people wrote (F34) — and a reader shows them
 * under their bare key or not at all.
 */
export interface PublicProfile extends ProfileSearchHit {
  readonly customFields: CustomFieldValues;
}

/** One page of the participant search, server-side filtered and sorted. */
export interface ProfileSearchPage {
  readonly rows: readonly ProfileSearchHit[];
  /** What the pages divide — the whole result, not this page's length. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/**
 * What the search screen sends.
 *
 * Both criteria are free text and both are split into words, all of which have
 * to match (F32, F126): `search` over the name **and** the field of activity,
 * `activityAreas` over the field of activity alone. Two boxes rather than one
 * with a syntax — "Amina" and "election observation" are different questions,
 * and the second one is how somebody looks for a person they do not know yet.
 */
export interface ProfileSearchQuery {
  readonly search?: string;
  readonly activityAreas?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

/**
 * How many profiles a page of the search holds.
 *
 * Larger than the ten of "my registrations": that list is somebody's own three
 * or four rows, this one is a directory that is browsed.
 */
export const DEFAULT_PROFILE_SEARCH_PAGE_SIZE = 20;

/** The most a client may ask for at once. */
export const MAX_PROFILE_SEARCH_PAGE_SIZE = 50;
