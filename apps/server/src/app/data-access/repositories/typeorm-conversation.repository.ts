import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  ConversationCounterpartRecord,
  ConversationMemberRef,
  ConversationMembershipRecord,
  ConversationOverviewRecord,
  ConversationRecord,
  ConversationRepository,
  ConversationSlice,
  NewOrganizerContact,
} from '../../business/chat/ports/conversation.repository';
import {
  ConversationEntity,
  ConversationMemberEntity,
  MessageEntity,
} from '../entities';

/**
 * The overview's one statement per page (FR 4.5 — E38).
 *
 * Written out rather than assembled by the query builder, and that is a
 * deliberate exception in this layer: the unread count is a **correlated**
 * subquery that reaches the outer `cm.last_read_at`, and a builder that
 * rewrites alias-qualified names is the wrong tool for a query whose whole
 * point is which alias each column belongs to. The reading order of the SQL is
 * also the reading order of the rule.
 *
 * The join is the access rule: a conversation the asking member is not in
 * cannot come out of this query at all (F152).
 */
const OVERVIEW = `
  SELECT c."id",
         c."type",
         c."event_id",
         c."topic",
         c."guest_email",
         c."guest_name",
         c."last_message_at",
         (SELECT COUNT(*)::int
            FROM "message" m
           WHERE m."conversation_id" = c."id"
             -- What somebody else wrote: an unread message of one's own would
             -- be a notification about oneself.
             AND NOT (m."sender_type" = $1 AND m."sender_id" = $2)
             -- NULL means "has read nothing", so everything counts.
             AND (cm."last_read_at" IS NULL
                  OR m."created_at" > cm."last_read_at")) AS "unread"
    FROM "conversation" c
    JOIN "conversation_member" cm
      ON cm."conversation_id" = c."id"
     AND cm."member_type" = $1
     AND cm."member_id" = $2`;

/**
 * Who each conversation of a page is with — one query for all of them (F49).
 *
 * Only account members are resolved. The organizer's side and a guest's arrive
 * with the packages that put them into a conversation (AP 9, AP 10); until then
 * no conversation has one, and a join against a table nothing writes would be a
 * capability without a caller.
 *
 * Read regardless of `searchable`: a running conversation says who it is with
 * even after its other side stopped being findable (E14, E37).
 */
const COUNTERPARTS = `
  SELECT cm."conversation_id" AS "conversationId",
         p."id"               AS "id",
         p."first_name"       AS "firstName",
         p."last_name"        AS "lastName",
         p."avatar_path"      AS "avatarPath",
         -- The picture's ?v= is built from this, so a new avatar is a new URL.
         p."updated_at"       AS "updatedAt"
    FROM "conversation_member" cm
    JOIN "user_profile" p ON p."id" = cm."member_id"
   WHERE cm."conversation_id" = ANY($1::uuid[])
     AND cm."member_type" = 'user'
     AND NOT (cm."member_type" = $2 AND cm."member_id" = $3)
   ORDER BY p."last_name" ASC, p."first_name" ASC, p."id" ASC`;

/**
 * PostgreSQL implementation of {@link ConversationRepository} (FR 4.5).
 *
 * Three properties, each of which is one statement:
 *
 * 1. **The direct conversation of two accounts** is inserted with `ON CONFLICT
 *    DO NOTHING` against `UQ_conversation_direct_key` and read back when the
 *    insert did nothing. "Look, then insert" is the race that would give two
 *    people two conversations; PostgreSQL blocks the conflicting insert until
 *    the other transaction commits, so the read back always finds the winner.
 *    Atomicity belongs in this layer, the rule above it (F43).
 * 2. **Unread arrives counted** — see {@link OVERVIEW}. Counted, never stored
 *    (E38, F56).
 * 3. **A page's counterparts are one query** — see {@link COUNTERPARTS}.
 */
@Injectable()
export class TypeormConversationRepository implements ConversationRepository {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversations: Repository<ConversationEntity>,
  ) {}

  async findOrCreateDirect(
    firstProfileId: string,
    secondProfileId: string,
  ): Promise<ConversationRecord> {
    const key = directKey(firstProfileId, secondProfileId);

    return this.conversations.manager.transaction(async (manager) => {
      const inserted = await manager
        .createQueryBuilder()
        .insert()
        .into(ConversationEntity)
        .values({ type: 'direct', directKey: key })
        // The whole race, in one clause: the loser inserts nothing and reads
        // the winner's row below.
        .orIgnore()
        .returning('id')
        .execute();

      const created = (inserted.raw as readonly { id: string }[])[0];
      if (created) {
        // Both memberships with the conversation. A conversation with one
        // member is a state no reader knows what to do with, and this is the
        // transaction that can guarantee it never exists.
        await manager.insert(ConversationMemberEntity, [
          {
            conversationId: created.id,
            memberType: 'user',
            memberId: firstProfileId,
          },
          {
            conversationId: created.id,
            memberType: 'user',
            memberId: secondProfileId,
          },
        ]);
      }

      return toRecord(
        await manager.findOneByOrFail(ConversationEntity, { directKey: key }),
      );
    });
  }

  async createOrganizerContact(
    contact: NewOrganizerContact,
  ): Promise<ConversationRecord> {
    return this.conversations.manager.transaction(async (manager) => {
      const conversation = await manager.save(
        manager.create(ConversationEntity, {
          type: 'organizer_contact',
          // The event whose page carried the form, and no topic: what the
          // request is about is the event, and a second field holding its name
          // would be the same fact stored twice (CHK_conversation_shape allows
          // both, and AP 9 chose).
          eventId: contact.eventId,
          topic: null,
          guestEmail: contact.guestEmail,
          guestName: contact.guestName,
          // Forbidden for anything but a direct conversation, which is what
          // makes the unique index over it mean what it says.
          directKey: null,
        }),
      );

      const message = await manager.save(
        manager.create(MessageEntity, {
          conversationId: conversation.id,
          // The one sender with no id: a guest is identified by the address on
          // the conversation (E39, CHK_message_sender_id).
          senderType: 'guest',
          senderId: null,
          body: contact.body,
          attachmentId: null,
        }),
      );

      // The overview sorts by this, so it is set with the line that justifies
      // it — the same rule the message repository follows, in the transaction
      // that also created the conversation.
      await manager.update(
        ConversationEntity,
        { id: conversation.id },
        { lastMessageAt: message.createdAt },
      );

      return toRecord({ ...conversation, lastMessageAt: message.createdAt });
    });
  }

  async listFor(
    member: ConversationMemberRef,
    offset: number,
    limit: number,
  ): Promise<ConversationSlice> {
    const rows = await this.conversations.manager.query<readonly RawOverview[]>(
      `${OVERVIEW}
        -- Newest activity first; an empty conversation sorts last, because
        -- "nothing has been said" is not news. The id breaks a shared
        -- timestamp, and is always the last criterion.
        ORDER BY c."last_message_at" DESC NULLS LAST, c."id" DESC
        OFFSET $3 LIMIT $4`,
      [member.memberType, member.memberId, offset, limit],
    );

    // Not a count over the join: the number of conversations somebody is in is
    // the number of their membership rows, which is one index lookup.
    const total = await this.conversations.manager.countBy(
      ConversationMemberEntity,
      { memberType: member.memberType, memberId: member.memberId },
    );

    return { rows: await this.withCounterparts(rows, member), total };
  }

  async overviewFor(
    conversationId: string,
    member: ConversationMemberRef,
  ): Promise<ConversationOverviewRecord | null> {
    const rows = await this.conversations.manager.query<readonly RawOverview[]>(
      `${OVERVIEW} AND c."id" = $3`,
      [member.memberType, member.memberId, conversationId],
    );

    const [overview] = await this.withCounterparts(rows, member);
    return overview ?? null;
  }

  async findMembership(
    conversationId: string,
    member: ConversationMemberRef,
  ): Promise<ConversationMembershipRecord | null> {
    const row = await this.conversations.manager.findOne(
      ConversationMemberEntity,
      {
        where: {
          conversationId,
          memberType: member.memberType,
          memberId: member.memberId,
        },
        relations: { conversation: true },
      },
    );
    return row
      ? { conversation: toRecord(row.conversation), lastReadAt: row.lastReadAt }
      : null;
  }

  async markRead(
    conversationId: string,
    member: ConversationMemberRef,
    at: Date,
  ): Promise<boolean> {
    const result = await this.conversations.manager.update(
      ConversationMemberEntity,
      {
        conversationId,
        memberType: member.memberType,
        memberId: member.memberId,
      },
      { lastReadAt: at },
    );
    // Zero rows is "not a member", which the caller turns into the answer an
    // unknown id gets.
    return (result.affected ?? 0) > 0;
  }

  private async withCounterparts(
    rows: readonly RawOverview[],
    member: ConversationMemberRef,
  ): Promise<readonly ConversationOverviewRecord[]> {
    if (rows.length === 0) return [];

    const people = await this.conversations.manager.query<
      readonly RawCounterpart[]
    >(COUNTERPARTS, [
      rows.map((row) => row.id),
      member.memberType,
      member.memberId,
    ]);

    const byConversation = new Map<string, ConversationCounterpartRecord[]>();
    for (const person of people) {
      const list = byConversation.get(person.conversationId) ?? [];
      list.push({
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        avatarPath: person.avatarPath,
        updatedAt: person.updatedAt,
      });
      byConversation.set(person.conversationId, list);
    }

    return rows.map((row) => ({
      conversation: fromRaw(row),
      counterparts: byConversation.get(row.id) ?? [],
      unread: Number(row.unread),
    }));
  }
}

/** What {@link OVERVIEW} answers with — column names, not entity properties. */
interface RawOverview {
  readonly id: string;
  readonly type: ConversationRecord['type'];
  readonly event_id: string | null;
  readonly topic: string | null;
  readonly guest_email: string | null;
  readonly guest_name: string | null;
  readonly last_message_at: Date | null;
  readonly unread: number;
}

/** What {@link COUNTERPARTS} answers with — the aliases it declares. */
interface RawCounterpart {
  readonly conversationId: string;
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly avatarPath: string | null;
  readonly updatedAt: Date;
}

/**
 * The two profile ids of a direct conversation, in a fixed order.
 *
 * Sorted, so "A writes to B" and "B writes to A" produce the same key and the
 * unique index sees them as one conversation. Built here and nowhere else: the
 * business layer asks for "the conversation of these two" and has no reason to
 * know that a string decides it.
 */
function directKey(first: string, second: string): string {
  return [first, second].sort().join(':');
}

function toRecord(row: ConversationEntity): ConversationRecord {
  return {
    id: row.id,
    type: row.type,
    eventId: row.eventId,
    topic: row.topic,
    guestEmail: row.guestEmail,
    guestName: row.guestName,
    lastMessageAt: row.lastMessageAt,
  };
}

function fromRaw(row: RawOverview): ConversationRecord {
  return {
    id: row.id,
    type: row.type,
    eventId: row.event_id,
    topic: row.topic,
    guestEmail: row.guest_email,
    guestName: row.guest_name,
    lastMessageAt: row.last_message_at,
  };
}
