/**
 * What a plug-in may learn about the people using it (E58, F55).
 *
 * Two questions, and they are the two a plug-in that stores something written
 * by a human cannot avoid: **who is asking**, so a row can be attributed and a
 * reader can be shown their own pending rows, and **what an author is called**,
 * so a list is readable by somebody other than its author.
 *
 * This file answers the second one. The first is a parameter decorator in
 * `current-actor.ts`, because who is asking is a fact about a request rather
 * than something to be looked up — the host's participant guard has already
 * resolved the session by the time a plug-in's handler runs (E33), and a plug-in
 * that resolved it again would be the second implementation of "is this cookie
 * still valid".
 *
 * What is deliberately **not** here:
 *
 * - **No address.** An author is a name and, if they uploaded one, a picture.
 *   A plug-in that could read e-mail addresses would be a way around F55 — the
 *   rule that a mail is addressed through a foreign key rather than by looking
 *   somebody up — and a forum does not write mail (the contract has no mail for
 *   plug-ins at all).
 * - **No search.** A plug-in resolves ids it already stored. There is no way to
 *   ask this port who exists, which is what keeps a participant directory the
 *   decision of `searchable` (E37, F13) rather than a side effect of enabling a
 *   plug-in.
 * - **No `searchable` filter either**, and that is the more interesting half:
 *   this port answers for **any** confirmed account, opted into the directory or
 *   not. Somebody who submits a proposal or writes a post has put their name on
 *   something inside the logged-in area on purpose; hiding it would leave a list
 *   of anonymous rows that FR 3.13 and FR 4.6 both read as attributed. That is
 *   why this is not `SearchableProfileRepository` behind a new name.
 *
 * Added in plug-in API 1.2.0. A plug-in built against 1.1.0 never asks.
 */

/** One author, in the shape a plug-in shows them in. */
export interface PluginAuthor {
  readonly id: string;
  /** First and last name in one string — what a list of contributions shows. */
  readonly name: string;
  /** The picture's public URL, or `null` if there is none (F124). */
  readonly avatarUrl: string | null;
}

export interface PluginParticipantReads {
  /**
   * The authors behind a set of ids, keyed by id.
   *
   * Many ids in one call rather than one call per row, because every caller is
   * rendering a list (F49). An id that has no confirmed account is simply
   * absent — a proposal whose author closed their account is a row the cascade
   * has already taken, so this only ever covers the width of one race, and a
   * caller that skips an absent id is doing the honest thing.
   */
  findAuthors(
    participantIds: readonly string[],
  ): Promise<ReadonlyMap<string, PluginAuthor>>;
}

/**
 * Injection token for {@link PluginParticipantReads}.
 *
 * Published by the plug-in host module, which is global — so a plug-in injects
 * this symbol and imports no core module.
 */
export const PLUGIN_PARTICIPANT_READS = Symbol(
  'TREFARO_PLUGIN_PARTICIPANT_READS',
);
