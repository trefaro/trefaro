/**
 * Conversations — the container the messages of FR 4.5 live in.
 *
 * A conversation is the thing two people (or a group) keep, and a message is
 * one line in it. That split is what makes the unread counter possible without
 * a column per recipient (E38): being read is a property of a **member**, so
 * the count is derived from `last_read_at` and never stored (F56).
 *
 * Three kinds exist (E39), and only one of them is opened by a participant:
 *
 * - `direct` — two accounts, started from the participant search (E37).
 * - `group` — assembled by the organizer around one event.
 * - `organizer_contact` — an interested person without an account and the
 *   organizer, where the address sits on the conversation rather than on an
 *   invented account row.
 *
 * The last two arrive with the packages that create them; the shapes here
 * describe all three, because a participant who is put into a group reads it
 * through the same list.
 */

/**
 * The chat's module key (FR 1.5, E42).
 *
 * Its own switch, like the search: `profiles` decides whether there are
 * accounts, `profile-search` whether the people in an instance may find each
 * other, and this one whether they may write to each other. An organization
 * that wants a participant directory without messaging switches this off, and
 * the conversation endpoints answer 404 (F53) — including the one that serves a
 * message's picture.
 *
 * It **requires** `profiles` (E42): a conversation is between accounts. Like
 * the search's prerequisite it is declared by the descriptor and enforced by
 * the module administration in both directions, never resolved silently.
 */
export const CHAT_MODULE_KEY = 'chat';

/** The three kinds of conversation (E39). */
export const CONVERSATION_TYPES = [
  'direct',
  'group',
  'organizer_contact',
] as const;

export type ConversationType = (typeof CONVERSATION_TYPES)[number];

/**
 * Who wrote a message (E39).
 *
 * `guest` is the one that carries no id: somebody who wrote from an event
 * landing page without an account is identified by the conversation's
 * `guest_email`, not by a row that pretends to be an account.
 */
export const MESSAGE_SENDER_TYPES = ['admin', 'user', 'guest'] as const;

export type MessageSenderType = (typeof MESSAGE_SENDER_TYPES)[number];

/**
 * The other side of a conversation, as a reader sees it.
 *
 * Name and picture, and — for an account — the id, so a row can link to the
 * profile. What it deliberately does not carry is an **address**, for the
 * reason the search does not: a participant reaches another participant in the
 * conversation itself (F55).
 *
 * A counterpart shows up here even when they have withdrawn `searchable` since
 * the conversation started: a running conversation stays readable and
 * answerable (E14, E37), and one whose other side turned into a blank would be
 * worse than one that says who it is with. Their **profile** is another matter
 * — `/api/participant/profiles/:id` answers 404 for them, and that is not a
 * contradiction: the name in a conversation is something they told this reader
 * themselves.
 */
export interface ConversationCounterpart {
  /**
   * `null` for the organizer and for a guest.
   *
   * The organizer is not a profile anybody may open, and a guest has no
   * account at all — so a client shows the name and offers no link.
   */
  readonly profileId: string | null;
  readonly name: string;
  /** Carries no stored path and a `?v=` that moves with the picture (F124). */
  readonly avatarUrl: string | null;
}

/**
 * One row of "my conversations".
 *
 * The list is sorted by {@link lastMessageAt}, so the conversation that moved
 * last is on top — the order every messenger has, and the reason
 * `conversation.last_message_at` exists as a column rather than as a subquery
 * over the messages.
 */
export interface ConversationSummary {
  readonly id: string;
  readonly type: ConversationType;
  /**
   * A group's topic, or `null`.
   *
   * A `direct` conversation has no title of its own: it is named by who it is
   * with, and a client draws the counterpart's name.
   */
  readonly topic: string | null;
  /** Everybody but the reader. Exactly one entry for a `direct` conversation. */
  readonly counterparts: readonly ConversationCounterpart[];
  /** `null` until somebody has written — a conversation may be empty. */
  readonly lastMessageAt: string | null;
  /**
   * How many messages the reader has not seen (E38).
   *
   * Counted from their own `last_read_at` and never stored, and it counts only
   * what somebody **else** wrote: an unread message of one's own would be a
   * notification about oneself.
   */
  readonly unread: number;
}

/** One page of "my conversations", server-side sorted and counted. */
export interface ConversationPage {
  readonly rows: readonly ConversationSummary[];
  /** What the pages divide — the whole list, not this page's length. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** What the search's "write to this person" button sends (E37). */
export interface StartConversationRequest {
  /**
   * The account to write to, by the id the search handed out.
   *
   * The only way to open a `direct` conversation, and the reason there is no
   * address in it: whoever may be written to is whoever the search shows, and
   * that is decided by their own `searchable` (E37, F13).
   */
  readonly profileId: string;
}

/** What a page of the conversation list holds — a short list, browsed rarely. */
export const DEFAULT_CONVERSATION_PAGE_SIZE = 20;

/** The most a client may ask for at once. */
export const MAX_CONVERSATION_PAGE_SIZE = 50;

/** Query of "my conversations" — nothing to filter by, only a window. */
export interface ConversationQuery {
  readonly page?: number;
  readonly pageSize?: number;
}
