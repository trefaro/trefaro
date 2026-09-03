/**
 * Port for conversations and who is in them (FR 4.5 — E38, E39).
 *
 * Three things about its shape are deliberate:
 *
 * - **Membership is the only credential this port knows.** Every method takes
 *   the asking member, and there is no "read any conversation" method to
 *   forget it on. The same construction as the search's port (F152): what must
 *   not go wrong is not checked above but made impossible below.
 * - **Unread arrives counted.** Not "give me the messages since a timestamp
 *   and let the service count them" — that is one query per row of the
 *   overview (F49), and the number would be built twice once the real-time
 *   package delivers it too. Counted in SQL from `last_read_at`, never stored
 *   (E38, F56).
 * - **The direct conversation of two accounts is asked for, not searched
 *   for.** {@link ConversationRepository.findOrCreateDirect} is one statement
 *   against a unique constraint, because "look, then insert" is a race that
 *   splits two people's messages across two conversations. Atomicity belongs
 *   in this layer, the rule above it (F43).
 */

import type {
  ConversationMemberType,
  ConversationType,
} from '@trefaro/shared-models';

/**
 * Whoever is asking: an account or an organizer, and which one (E39).
 *
 * The type comes from `shared-models` since AP 7, where the real-time payloads
 * needed the same two words: both values exist in the schema from AP 6 on,
 * only `user` is written by it, and the organizer's side arrives with the
 * packages that put them in a conversation — the contact request of AP 9 and
 * the group of AP 10. Two spellings of a two-value union is how one of them
 * grows a third value alone.
 */
export interface ConversationMemberRef {
  readonly memberType: ConversationMemberType;
  readonly memberId: string;
}

/** A conversation in business-layer terms — no ORM types. */
export interface ConversationRecord {
  readonly id: string;
  readonly type: ConversationType;
  readonly eventId: string | null;
  readonly topic: string | null;
  readonly guestEmail: string | null;
  readonly guestName: string | null;
  readonly lastMessageAt: Date | null;
}

/**
 * A member of a conversation who has an account.
 *
 * The picture travels as its **stored path** and the row's timestamp, like
 * every other profile read: the URL is built once, in `avatarUrl` (F124), and
 * a path never leaves the server.
 *
 * Read regardless of `searchable`, and that is the point: a conversation that
 * is running says who it is with even after its other side stopped being
 * findable (E14, E37). Their profile page still answers 404 — the name in a
 * conversation is something they told this reader themselves.
 */
export interface ConversationCounterpartRecord {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly avatarPath: string | null;
  readonly updatedAt: Date;
}

/** One row of somebody's conversation overview. */
export interface ConversationOverviewRecord {
  readonly conversation: ConversationRecord;
  /**
   * The account members other than the asker.
   *
   * Only accounts: an organizer or a guest on the other side is resolved by
   * the package that puts them there (AP 9, AP 10), and until then no
   * conversation has one.
   */
  readonly counterparts: readonly ConversationCounterpartRecord[];
  /** Messages the asker has not seen, written by somebody else (E38). */
  readonly unread: number;
}

export interface ConversationSlice {
  readonly rows: readonly ConversationOverviewRecord[];
  readonly total: number;
}

/** What a member's place in one conversation says. */
export interface ConversationMembershipRecord {
  readonly conversation: ConversationRecord;
  readonly lastReadAt: Date | null;
}

/**
 * A question from somebody without an account, and who asked it (E39, F11).
 *
 * Carries the guest's first line, because the conversation is written **with**
 * it: an `organizer_contact` row without a message says that a stranger
 * pressed a button, which is nothing the organizer's overview could act on.
 * A `direct` conversation may be empty — two accounts have exactly one and it
 * exists from the moment either of them opens it — but this kind is created by
 * the act of writing, so both rows belong to one transaction.
 */
export interface NewOrganizerContact {
  /** The event whose landing page carried the form. */
  readonly eventId: string;
  readonly guestEmail: string;
  readonly guestName: string;
  /** What they wrote. Never empty — the caller has already refused that. */
  readonly body: string;
}

export interface ConversationRepository {
  /**
   * The one direct conversation of two accounts, created if there is none.
   *
   * Order of the two ids does not matter, and both memberships are written
   * with the conversation: a conversation with one member is a state no reader
   * knows what to do with.
   */
  findOrCreateDirect(
    firstProfileId: string,
    secondProfileId: string,
  ): Promise<ConversationRecord>;

  /**
   * Opens a contact request and writes its first line (FR 3.4, E39).
   *
   * Always a new conversation, never a lookup by address: nothing
   * authenticates `guest_email`, so folding two requests into one thread would
   * assert that the same person sent both — and would let anybody who knows an
   * address write into a thread the organizer has already answered.
   *
   * **No membership row is written.** The organizer's side of a contact
   * request is the organization, and the organization is not an account: an
   * `admin` membership would name whichever person happened to be logged in
   * when the guest wrote, which is nobody, and an admin added tomorrow would
   * be blind to what arrived today. The kind of the conversation is what says
   * whose it is.
   */
  createOrganizerContact(
    contact: NewOrganizerContact,
  ): Promise<ConversationRecord>;

  /** One page of "my conversations", newest activity first. */
  listFor(
    member: ConversationMemberRef,
    offset: number,
    limit: number,
  ): Promise<ConversationSlice>;

  /** One row of that overview, or `null` when the asker is not a member. */
  overviewFor(
    conversationId: string,
    member: ConversationMemberRef,
  ): Promise<ConversationOverviewRecord | null>;

  /**
   * The asker's membership, or `null`.
   *
   * `null` covers "no such conversation" and "not a member", which the
   * business layer answers with one sentence: an id somebody is not in is an
   * id they must not be able to confirm.
   */
  findMembership(
    conversationId: string,
    member: ConversationMemberRef,
  ): Promise<ConversationMembershipRecord | null>;

  /**
   * Moves the asker's `last_read_at` (E38).
   *
   * @returns whether a membership was there to move — the caller turns `false`
   * into the same answer {@link findMembership} does.
   */
  markRead(
    conversationId: string,
    member: ConversationMemberRef,
    at: Date,
  ): Promise<boolean>;
}

export const CONVERSATION_REPOSITORY = Symbol(
  'TREFARO_CONVERSATION_REPOSITORY',
);
