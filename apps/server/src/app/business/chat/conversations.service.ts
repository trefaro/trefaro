import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_CONVERSATION_PAGE_SIZE,
  MAX_CONVERSATION_PAGE_SIZE,
  type ConversationCounterpart,
  type ConversationPage,
  type ConversationQuery,
  type ConversationSummary,
} from '@trefaro/shared-models';
import {
  SEARCHABLE_PROFILE_REPOSITORY,
  type SearchableProfileRepository,
} from '../common/ports/searchable-profile.repository';
import { avatarUrl } from '../profiles';
import {
  CONVERSATION_REPOSITORY,
  type ConversationMemberRef,
  type ConversationOverviewRecord,
  type ConversationRepository,
  type ConversationMembershipRecord,
} from './ports/conversation.repository';

/**
 * What every refusal to open a conversation says.
 *
 * One sentence for four states — no such id, an unconfirmed account, a profile
 * that did not opt in, and one that withdrew — because the difference is
 * exactly what the asker must not learn. The same reasoning as the search's
 * 404 (F124): whoever can tell a hidden profile from a missing one can
 * enumerate the accounts of an instance, and a **403** rather than a 404 is
 * what the acceptance criterion of this package asks for — "you may not write
 * to this profile", said the same way whether the reason is privacy or
 * absence.
 */
const NOT_CONTACTABLE =
  'This profile cannot be written to. Only participants who made themselves ' +
  'findable can be contacted.';

/**
 * What every conversation somebody is not in says.
 *
 * Membership, not existence: an id that is not the asker's is an id they must
 * not be able to confirm, so "no such conversation" and "not yours" are one
 * 404. A conversation id is a uuid and reaches a client only through this
 * person's own overview.
 */
export const NO_SUCH_CONVERSATION = 'No conversation of that id is yours.';

/**
 * Conversations: who may open one, whose they are, and what has been read
 * (FR 4.5 — E37, E38, E39).
 *
 * The service that owns the access rule of the whole chat, in two halves that
 * are deliberately **not** the same check:
 *
 * 1. **Opening** a direct conversation asks whether the other person can be
 *    written to, which is their `searchable` and nothing else (E37, F13). One
 *    switch for being found and being contacted — the alternative would be a
 *    privacy switch that does not say who may reach me.
 * 2. **Everything afterwards** asks for membership only. Somebody who
 *    withdraws the switch disappears from the search and cannot be written to
 *    anew, but the conversations they are in stay readable and answerable
 *    (E14) — for both sides. A rule that silenced a running conversation would
 *    turn a privacy setting into a way to end a discussion with no trace.
 *
 * Unread counts are the third thing here, and they are counted rather than
 * stored (E38, F56): `conversation_member.last_read_at` is the only state, and
 * the count is derived from it in the same statement that reads the row.
 */
@Injectable()
export class ConversationsService {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversations: ConversationRepository,
    @Inject(SEARCHABLE_PROFILE_REPOSITORY)
    private readonly profiles: SearchableProfileRepository,
  ) {}

  /**
   * Opens the direct conversation with another account, or finds it (E37).
   *
   * Idempotent by design, and the answer is the same either way: two people
   * have one conversation, not one per press of the button. The unique
   * constraint behind `findOrCreateDirect` is what makes that true under two
   * simultaneous presses as well.
   *
   * @throws BadRequestException — one's own id. Not a 403: the asker knows
   * their own id, so there is nothing to hide, and a client that sends it has
   * a bug that deserves to be named.
   * @throws ForbiddenException — anything else that cannot be written to.
   */
  async start(
    viewerId: string,
    profileId: string,
  ): Promise<ConversationSummary> {
    if (profileId === viewerId) {
      throw new BadRequestException(
        'A conversation has two sides. There is no conversation with oneself.',
      );
    }

    // The one moment `searchable` is asked about (E37). Through the port whose
    // statements cannot answer with a hidden profile at all (F152), so this is
    // "is there a profile to write to", not "is the flag set".
    const other = await this.profiles.findVisible(profileId);
    if (!other) throw new ForbiddenException(NOT_CONTACTABLE);

    const conversation = await this.conversations.findOrCreateDirect(
      viewerId,
      profileId,
    );

    // Read back the way the overview reads it rather than assembled from what
    // is at hand: an existing conversation may have unread messages in it, and
    // answering `unread: 0` because this request happened to create nothing
    // would be a number that is simply wrong.
    const overview = await this.conversations.overviewFor(
      conversation.id,
      member(viewerId),
    );
    if (!overview) throw new NotFoundException(NO_SUCH_CONVERSATION);
    return toSummary(overview);
  }

  /** One page of "my conversations", newest activity first (E38). */
  async list(
    viewerId: string,
    query: ConversationQuery,
  ): Promise<ConversationPage> {
    const pageSize = clamp(
      positive(query.pageSize, DEFAULT_CONVERSATION_PAGE_SIZE),
      1,
      MAX_CONVERSATION_PAGE_SIZE,
    );
    const page = positive(query.page, 1);

    const slice = await this.conversations.listFor(
      member(viewerId),
      (page - 1) * pageSize,
      pageSize,
    );

    return {
      rows: slice.rows.map(toSummary),
      total: slice.total,
      page,
      pageSize,
    };
  }

  /**
   * The asker's membership, or the one 404 (E38).
   *
   * The gate every other conversation route goes through, including the ones
   * in {@link MessagesService}: one place decides what "not yours" answers, so
   * a new route cannot invent a second wording — or a second status code, which
   * would be the enumeration oracle.
   */
  async require(
    viewerId: string,
    conversationId: string,
  ): Promise<ConversationMembershipRecord> {
    const membership = await this.membershipOf(viewerId, conversationId);
    if (!membership) throw new NotFoundException(NO_SUCH_CONVERSATION);
    return membership;
  }

  /**
   * The same question without the exception.
   *
   * For the one caller that has its **own** sentence to say: the route that
   * serves a message's picture answers "no such picture" whether the message
   * does not exist, carries no picture, or is in somebody else's conversation
   * — three states, one answer, and it must not be able to leak which by
   * borrowing this service's wording.
   */
  async membershipOf(
    viewerId: string,
    conversationId: string,
  ): Promise<ConversationMembershipRecord | null> {
    return this.conversations.findMembership(conversationId, member(viewerId));
  }

  /**
   * Marks everything up to now as read (E38).
   *
   * Up to *now*, not up to a message the client names: a client that has the
   * conversation open has seen what is in it, and a "read up to here" that a
   * caller could choose would let it report progress it did not make. The
   * counter is derived from this timestamp, so moving it forward is the whole
   * operation — there is nothing per message to write.
   */
  async markRead(viewerId: string, conversationId: string): Promise<void> {
    const marked = await this.conversations.markRead(
      conversationId,
      member(viewerId),
      new Date(),
    );
    if (!marked) throw new NotFoundException(NO_SUCH_CONVERSATION);
  }
}

/** A participant as this module's ports address them (E39). */
function member(profileId: string): ConversationMemberRef {
  return { memberType: 'user', memberId: profileId };
}

function toSummary(row: ConversationOverviewRecord): ConversationSummary {
  return {
    id: row.conversation.id,
    type: row.conversation.type,
    topic: row.conversation.topic,
    counterparts: row.counterparts.map(toCounterpart),
    lastMessageAt: row.conversation.lastMessageAt?.toISOString() ?? null,
    unread: row.unread,
  };
}

function toCounterpart(
  counterpart: ConversationOverviewRecord['counterparts'][number],
): ConversationCounterpart {
  return {
    profileId: counterpart.id,
    // One name, assembled the way every other screen of this application
    // assembles it, and deliberately not two fields: a conversation shows who
    // it is with, it does not sort people by surname.
    name: `${counterpart.firstName} ${counterpart.lastName}`.trim(),
    // The media route built from the id and the row's timestamp (F124) — the
    // one construction of that URL, imported rather than repeated (F113).
    avatarUrl: avatarUrl(
      counterpart.id,
      counterpart.avatarPath,
      counterpart.updatedAt,
    ),
  };
}

/**
 * A page number that is not one falls back to the default.
 *
 * The same reading the search and the contact list take: a zeroth page is not
 * a smaller request but no request. The DTO refuses it with a 400 first; this
 * is what keeps the service honest when it is called from anywhere else.
 */
function positive(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value as number) > 0
    ? (value as number)
    : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
