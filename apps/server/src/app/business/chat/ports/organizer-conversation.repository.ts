import type {
  MessageSenderType,
  OrganizerConversationType,
} from '@trefaro/shared-models';
import type { ConversationCounterpartRecord } from './conversation.repository';

/**
 * Port for the conversations the organization is part of (FR 3.4 — E39, F133).
 *
 * A **second** port over the same two tables, and that is the decision to
 * keep. {@link ConversationRepository} is built so that membership is the only
 * credential it knows: every method takes the asking member, and there is no
 * "read any conversation" method to forget it on (F152). The organizer has no
 * membership — the organization is not an account, so a contact request and a
 * group carry no `admin` row (F133) — so serving the overview through that
 * port would have meant adding exactly the method it was designed without.
 *
 * Instead the rule moves into the statements: **every read here is scoped to
 * `type IN ('group', 'organizer_contact')`**. Two participants writing to each
 * other cannot come out of this port at all — not from the list, not by id,
 * not as a member list — which is a stronger guarantee than a check above it,
 * and the same construction the profile search uses (F152). An organizer who
 * guesses a `direct` id gets the answer an unknown id gets.
 *
 * What it deliberately does **not** have: a read marker. There is nowhere to
 * put one (F133), and the overview replaces it with `awaitsAnswer`, computed
 * from who wrote last — see {@link OrganizerConversationRecord.preview}.
 */

/** A conversation of the organization, in business-layer terms. */
export interface OrganizerConversationRecord {
  readonly id: string;
  readonly type: OrganizerConversationType;
  /** The event: a group's own, or the page a question was asked on. */
  readonly eventId: string | null;
  readonly topic: string | null;
  readonly guestEmail: string | null;
  readonly guestName: string | null;
  readonly lastMessageAt: Date | null;
  /** Accounts in it — `0` for a contact request, which has no member rows. */
  readonly memberCount: number;
  /** The last line, or `null` for a group nobody has written in yet. */
  readonly preview: MessagePreviewRecord | null;
}

/**
 * The newest line of a conversation, as much as a row needs.
 *
 * Carries `senderType` because that is the whole of "is this waiting for an
 * answer": the question is asked once, in `awaitsAnswer`, from data the row
 * already has, rather than stored as a state somebody has to maintain.
 *
 * The text arrives **already cut** to `MESSAGE_PREVIEW_LENGTH`. A page of
 * twenty rows would otherwise carry twenty whole messages so that a client
 * could show twenty first lines.
 */
export interface MessagePreviewRecord {
  readonly senderType: MessageSenderType;
  readonly text: string | null;
  readonly hasImage: boolean;
}

export interface OrganizerConversationSlice {
  readonly rows: readonly OrganizerConversationRecord[];
  /** What the pages divide — every conversation of the organization. */
  readonly total: number;
}

/**
 * Somebody who may be put into a group, as the port answers it.
 *
 * The name arrives in two fields and is assembled above, the way every other
 * name in this application is (F138) — the port answers with columns.
 */
export interface GroupCandidateRecord {
  readonly profileId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
}

/** A group on its way into being (E39). */
export interface NewGroup {
  readonly eventId: string;
  readonly topic: string;
  /**
   * Who is in it — checked by the insert itself, not by its caller.
   *
   * See {@link OrganizerConversationRepository.createGroup}: the statement that
   * writes the memberships derives the eligible people from the event's own
   * confirmed registrations, so an id from anywhere else cannot become a
   * member.
   */
  readonly profileIds: readonly string[];
}

export interface OrganizerConversationRepository {
  /** One page of the organization's conversations, newest activity first. */
  list(offset: number, limit: number): Promise<OrganizerConversationSlice>;

  /**
   * One of them by id, or `null`.
   *
   * `null` covers "no such conversation" and "that is two participants'
   * private conversation", which the business layer answers with one sentence:
   * the organizer may not learn that an id they cannot read exists.
   */
  find(conversationId: string): Promise<OrganizerConversationRecord | null>;

  /**
   * The accounts in one of them.
   *
   * Scoped like every other read here, so it cannot be asked about a `direct`
   * conversation — which is what keeps it from being the `membersOf(id)` that
   * {@link MessageRepository} refuses to have: that one would answer "who
   * talks to whom" for **any** id, this one only for conversations the
   * organization is part of.
   *
   * Read regardless of `searchable`: somebody the organizer put into a group
   * is in it whether or not they are findable (E14, E37).
   */
  membersOf(
    conversationId: string,
  ): Promise<readonly ConversationCounterpartRecord[]>;

  /**
   * Who may be put into a group for this event (E39).
   *
   * The event's **confirmed** registrations that have a **confirmed** account,
   * matched by address — the one link between a registration and a person
   * (E31), because a registration carries no profile id. Sorted by name.
   */
  groupCandidatesOf(eventId: string): Promise<readonly GroupCandidateRecord[]>;

  /**
   * Assembles a group, or writes nothing.
   *
   * One transaction: the conversation and every membership, because a group
   * with no members is a conversation nobody can read and the schema would
   * happily hold one.
   *
   * @returns the conversation, or `null` when at least one of the requested
   * people is not a confirmed registrant of the event with an account. The
   * eligibility is the insert's own `SELECT`, so this is not a check that can
   * be skipped by a second caller — and it answers `null` rather than
   * quietly adding fewer people, because a group that is missing somebody the
   * organizer picked is worse than one that was not created.
   */
  createGroup(group: NewGroup): Promise<OrganizerConversationRecord | null>;
}

export const ORGANIZER_CONVERSATION_REPOSITORY = Symbol(
  'TREFARO_ORGANIZER_CONVERSATION_REPOSITORY',
);
