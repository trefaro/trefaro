/**
 * The organization's side of the conversations (FR 3.4, UC 14 — E39, F133).
 *
 * A mail-program-like overview, as FR 3.4 asks for it: everything the
 * organization is part of in one list, with the history and a field to answer
 * in. Two kinds show up in it — the questions of people without an account
 * (`organizer_contact`) and the groups an organizer assembles around an event
 * (`group`) — and the third one, two participants writing to each other, never
 * does. That is not a filter this list applies; it is what the statements
 * behind it can read at all.
 *
 * The shapes here are deliberately **not** {@link ConversationSummary}. A
 * participant's row is named by who it is with and counted by what they have
 * not read; the organization's row is named by an event and a subject, and
 * there is nobody whose "read" it could count: the organizer's side has no
 * membership row, on purpose (F133). What replaces the unread badge is
 * {@link awaitsAnswer} — computed from who wrote last, stored nowhere, and a
 * better question for a shared mailbox than "have *I* read it".
 */

import type {
  ConversationCounterpart,
  MessageSenderType,
} from './conversations';
import type { ChatMessage } from './messages';

/**
 * The two kinds the organization is part of.
 *
 * A subset of {@link ConversationType} rather than the whole union, so a
 * payload cannot claim to be a `direct` conversation the organizer may read.
 * In the order of that union, because two orders for one set is how somebody
 * ends up asserting the wrong one.
 */
export const ORGANIZER_CONVERSATION_TYPES = [
  'group',
  'organizer_contact',
] as const;

export type OrganizerConversationType =
  (typeof ORGANIZER_CONVERSATION_TYPES)[number];

/**
 * The event a conversation is about.
 *
 * Both slugs travel, so the overview can link to the page the question was
 * asked on (F112) — for a contact request that page *is* the context: "where
 * is the recording" makes sense once you can see which event was on screen.
 * `null` never happens for either kind today; the field is nullable because
 * the column is, and a payload that claimed otherwise would be a promise the
 * schema does not make.
 */
export interface ConversationEventRef {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly seriesSlug: string;
}

/**
 * Somebody without an account, as the organizer sees them (E39).
 *
 * The address is the identity here, and unlike everywhere else in this
 * application it is shown to the organizer on purpose: the answer to a person
 * with no account goes out by mail (F11), so the mailbox it will go to is part
 * of what the screen has to say.
 */
export interface ConversationGuest {
  readonly name: string | null;
  readonly email: string;
}

/** The last line of a conversation, as much of it as a list row shows. */
export interface ConversationPreview {
  /** Who wrote it — what {@link awaitsAnswer} reads. */
  readonly senderType: MessageSenderType;
  /**
   * The first {@link MESSAGE_PREVIEW_LENGTH} characters, or `null`.
   *
   * Cut by the server rather than by the client's stylesheet: a page of twenty
   * rows would otherwise ship twenty whole messages in order to show twenty
   * first lines.
   */
  readonly text: string | null;
  /** Whether that line carried a picture — a message may be only that (E40). */
  readonly hasImage: boolean;
}

/** One row of the organization's overview. */
export interface OrganizerConversationSummary {
  readonly id: string;
  readonly type: OrganizerConversationType;
  /** A group's subject. A contact request is named by its event (F133). */
  readonly topic: string | null;
  readonly event: ConversationEventRef | null;
  /** Set for a contact request, `null` for a group. */
  readonly guest: ConversationGuest | null;
  /**
   * How many accounts are in it.
   *
   * Always `0` for a contact request — a guest has no row to count, and the
   * organization has none either (F133). For a group it is the number of
   * participants who will read what is written there.
   */
  readonly memberCount: number;
  /** `null` for a group nobody has written in yet. */
  readonly lastMessageAt: string | null;
  readonly preview: ConversationPreview | null;
}

/**
 * Whether this conversation is waiting for the organization.
 *
 * The organizer's answer to the unread badge, and it is a different question:
 * a shared mailbox has several readers, so "unread by me" says little, whereas
 * "nobody has answered this yet" is exactly what an organization has to see. A
 * function rather than a field, because it must not be possible for the two to
 * disagree — it is read from who wrote last, which the row already carries.
 *
 * A conversation nobody has written in is not waiting for anything.
 */
export function awaitsAnswer(row: OrganizerConversationSummary): boolean {
  return row.preview !== null && row.preview.senderType !== 'admin';
}

/**
 * One conversation, as its own screen needs it.
 *
 * The row plus the names of the accounts in it. Names are on the detail rather
 * than on every row for the reason the participant's list leaves them off a
 * group: a page of rows would carry every member of every group in it, and a
 * list shows how many, not who.
 */
export interface OrganizerConversationDetail extends OrganizerConversationSummary {
  readonly members: readonly ConversationCounterpart[];
}

/** One page of the overview, server-side sorted and counted. */
export interface OrganizerConversationPage {
  readonly rows: readonly OrganizerConversationSummary[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Query of the overview — a window, and nothing to filter by. */
export interface OrganizerConversationQuery {
  readonly page?: number;
  readonly pageSize?: number;
}

/**
 * Somebody who may be put into a group (E39).
 *
 * A confirmed registration of the event **that has an account**: a group is a
 * conversation, a conversation needs members, and a membership points at a
 * profile. Somebody who registered without ever creating an account is
 * therefore absent from this list — they are reached by mail, which is what
 * the invitation (FR 2.4) and the registration mails are for.
 *
 * The address travels with the name because two people share a name and the
 * organizer already reads these addresses in the participant overview (E13).
 */
export interface GroupCandidate {
  readonly profileId: string;
  readonly name: string;
  readonly email: string;
}

/** What assembling a group says. */
export interface NewGroupRequest {
  /** The event the group is about — required by the schema for this kind. */
  readonly eventId: string;
  readonly topic: string;
  /**
   * Who is in it, by the ids {@link GroupCandidate} handed out.
   *
   * Every one of them has to be a confirmed registrant of {@link eventId} with
   * an account, and that is not merely validated above the data: the insert
   * derives the eligible set itself, so an id from anywhere else adds nobody
   * and the group is not created at all.
   */
  readonly profileIds: readonly string[];
}

/** What became of a reply's mail leg (F174). */
export const REPLY_DELIVERIES = ['none', 'sent', 'failed'] as const;

export type ReplyDelivery = (typeof REPLY_DELIVERIES)[number];

/**
 * The answer to a reply: the line, and what happened to the mail.
 *
 * Three values rather than a boolean, because "no mail was sent" and "the mail
 * failed" are different facts and only one of them is a problem: a group is
 * read in the app, so there is nothing to send (`none`); a contact request is
 * answered by mail (F11), so `failed` is something the organizer has to see —
 * they would otherwise believe they had answered somebody who never heard
 * from them. The message is stored either way, which is why this is a field on
 * a successful answer and not an error.
 */
export interface OrganizerReply {
  readonly message: ChatMessage;
  readonly delivery: ReplyDelivery;
}

/** How much of the last message a list row carries. */
export const MESSAGE_PREVIEW_LENGTH = 160;

/** As long as `conversation.topic` — a subject line, not a description. */
export const MAX_GROUP_TOPIC_LENGTH = 200;

/**
 * The most members one request may put into a group.
 *
 * A bound on the array, not on the group: an event with more confirmed
 * registrants than this is a mailing, not a conversation, and the invitation
 * mechanism is what serves it (FR 2.4). It also keeps one request from
 * writing an unbounded number of rows.
 */
export const MAX_GROUP_MEMBERS = 200;

/** What a page of the overview holds. */
export const DEFAULT_ORGANIZER_CONVERSATION_PAGE_SIZE = 20;

/** The most a client may ask for at once. */
export const MAX_ORGANIZER_CONVERSATION_PAGE_SIZE = 50;

/**
 * Where the organizer client keeps this overview.
 *
 * One spelling for the client's route and for the link a notification mail
 * carries (F172): AP 9 could only point at the organizer client's front door,
 * because the screen did not exist. It does now, so the mail about a question
 * leads to the question — and it leads there through this constant, so a
 * renamed route cannot leave the mail pointing at nothing.
 */
export const ORGANIZER_MESSAGES_PATH = '/messages';

/** The address of one conversation in the organizer client. */
export function organizerConversationPath(conversationId: string): string {
  return `${ORGANIZER_MESSAGES_PATH}/${conversationId}`;
}
