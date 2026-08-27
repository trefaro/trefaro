import type { MediaLinkSummary } from '@trefaro/shared-models';

/**
 * Counting port for the dashboard's media tile (FR 3.8, FR 3.6).
 *
 * The third of these ports, and the line is the one written down on
 * `ProgramTally`: a narrow tally exists where the rows are large or unbounded.
 * Media links are small, but there is no ceiling on how many an event
 * accumulates over a three-day programme with a recording per session — and the
 * dashboard wants four numbers, not the URLs.
 *
 * Kept apart from {@link MediaLinkRepository} on purpose: the dashboard is
 * allowed to know how much there is and nothing about what it points at.
 */
export interface MediaLinkTally {
  countForEvent(eventId: string): Promise<MediaLinkSummary>;
}

export const MEDIA_LINK_TALLY = Symbol('TREFARO_MEDIA_LINK_TALLY');
