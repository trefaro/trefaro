/**
 * External stream, recording and material links of an event (FR 3.6, F10).
 *
 * The thesis' building block view draws a "streaming" module that the functional
 * requirements never specified; F10 settled it as variant (a): this instance
 * *refers* to media somebody else hosts. There is no upload here, no
 * transcoding, no player.
 *
 * Two decisions shape everything below:
 *
 * 1. **Links, not embeds.** A link is a click the visitor decides to make. An
 *    `<iframe>` would load a third party's code — in practice Google's — into a
 *    page that promises not to (NFR 9), and it would do so before anybody asked.
 *    For the same reason nothing here fetches the target: no oEmbed lookup, no
 *    thumbnail, no title guessing. The organizer types the title.
 * 2. **The kind is the order.** {@link MEDIA_LINK_KINDS} is both the set of
 *    valid values and the sequence they are shown in: what is on now, what can
 *    be watched again, what can be read. Within one kind the order is the order
 *    they were added — a `sort` column would be a second ordering nobody
 *    maintains, the same reasoning that kept it off `program_item` (F40).
 *
 * The labels are English here and become translatable with the rest of the UI in
 * phase 2 (Transloco); they live in one place so that change is one change.
 */

/**
 * What a link points at — and the order the sections appear in.
 *
 * `stream` is where the event happens live, `recording` is it afterwards,
 * `material` is everything to read: slides, the report, a photo album.
 */
export type MediaLinkKind = 'stream' | 'recording' | 'material';

export const MEDIA_LINK_KINDS: readonly MediaLinkKind[] = [
  'stream',
  'recording',
  'material',
];

/** Singular and plural, because a section heading needs the second one. */
export interface MediaLinkKindLabel {
  readonly one: string;
  readonly many: string;
}

export const MEDIA_LINK_KIND_LABELS: Readonly<
  Record<MediaLinkKind, MediaLinkKindLabel>
> = {
  stream: { one: 'Live stream', many: 'Live streams' },
  recording: { one: 'Recording', many: 'Recordings' },
  material: { one: 'Material', many: 'Materials' },
};

export const MAX_MEDIA_LINK_TITLE_LENGTH = 200;
export const MAX_MEDIA_LINK_URL_LENGTH = 512;

/**
 * How many links one event may hold.
 *
 * A ceiling rather than a limit anybody is meant to reach: a conference with a
 * recording per session of a three-day programme lands well under it, and the
 * number keeps a scripted mistake from filling the table.
 */
export const MAX_MEDIA_LINKS_PER_EVENT = 200;

/** Configuration key of the module these links belong to (FR 1.5). */
export const MEDIA_LINKS_MODULE_KEY = 'media-links';

/** What a participant sees on the landing page, with no login. */
export interface PublicMediaLink {
  readonly id: string;
  readonly kind: MediaLinkKind;
  /** What the link says. Written by the organizer, never fetched from the target. */
  readonly title: string;
  readonly url: string;
  /**
   * The session this link belongs to, or `null` for the event as a whole.
   *
   * A session's links are rendered with the session, so the recording of the
   * keynote sits under the keynote rather than in a list of forty URLs.
   */
  readonly programItemId: string | null;
}

/** What an organizer manages. */
export interface MediaLink extends PublicMediaLink {
  readonly eventId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MediaLinkInput {
  readonly kind: MediaLinkKind;
  readonly title: string;
  readonly url: string;
  /** Must be a session of the same event; omitted means the event as a whole. */
  readonly programItemId?: string | null;
}

/** Every field optional; only what is sent gets written. */
export interface MediaLinkChange {
  readonly kind?: MediaLinkKind;
  readonly title?: string;
  readonly url?: string;
  readonly programItemId?: string | null;
}

/** What the dashboard's media tile says (FR 3.8). */
export interface MediaLinkSummary {
  readonly links: number;
  readonly streams: number;
  readonly recordings: number;
  readonly materials: number;
}

/**
 * Whether a string is a URL a browser may be sent to.
 *
 * `http` and `https` only. The point is not tidiness: `javascript:` in an
 * `href` is a script the visitor runs by clicking a link the organizer typed,
 * and a bare word renders as a link that quietly resolves against this instance.
 * Checked in the client for immediate feedback, in the DTO, and again in the
 * service — the last one because a second entry point must not be able to store
 * what the first refuses.
 */
export function isWebUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

/** The label of a kind, in the number the caller is talking about. */
export function mediaLinkKindLabel(kind: MediaLinkKind, count = 1): string {
  const label = MEDIA_LINK_KIND_LABELS[kind];
  return count === 1 ? label.one : label.many;
}

/**
 * Sorted the way the sections are shown: by kind, then as they were added.
 *
 * The kind's position in {@link MEDIA_LINK_KINDS} is the order — one array for
 * both the valid values and their sequence, so a new kind cannot arrive without
 * a place to stand. Stable within a kind, which is what keeps "as they were
 * added" true for a list the repository already returns in that order.
 */
export function sortMediaLinks<T extends { readonly kind: MediaLinkKind }>(
  links: readonly T[],
): readonly T[] {
  return [...links].sort(
    (a, b) =>
      MEDIA_LINK_KINDS.indexOf(a.kind) - MEDIA_LINK_KINDS.indexOf(b.kind),
  );
}

/** One rendered section of a media list. */
export interface MediaLinkGroup<T> {
  readonly kind: MediaLinkKind;
  /** Plural label of the kind, ready to be a heading. */
  readonly label: string;
  readonly links: readonly T[];
}

/**
 * The links grouped into their sections, empty kinds left out.
 *
 * Left out rather than rendered empty, for the same reason the dashboard has no
 * tile for a module that does not exist (F47): a heading over nothing is a
 * promise the page does not keep.
 */
export function groupMediaLinksByKind<
  T extends { readonly kind: MediaLinkKind },
>(links: readonly T[]): readonly MediaLinkGroup<T>[] {
  return MEDIA_LINK_KINDS.map((kind) => ({
    kind,
    label: MEDIA_LINK_KIND_LABELS[kind].many,
    links: links.filter((link) => link.kind === kind),
  })).filter((group) => group.links.length > 0);
}

/** The links that belong to the event as a whole, not to one session. */
export function eventMediaLinks<
  T extends { readonly programItemId: string | null },
>(links: readonly T[]): readonly T[] {
  return links.filter((link) => link.programItemId === null);
}

/** The links of one session (FR 3.6 — the recording sits with its session). */
export function programItemMediaLinks<
  T extends { readonly programItemId: string | null },
>(links: readonly T[], programItemId: string): readonly T[] {
  return links.filter((link) => link.programItemId === programItemId);
}
