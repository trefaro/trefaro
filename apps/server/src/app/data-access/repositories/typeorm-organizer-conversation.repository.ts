import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MESSAGE_PREVIEW_LENGTH,
  type MessageSenderType,
} from '@trefaro/shared-models';
import type { ConversationCounterpartRecord } from '../../business/chat/ports/conversation.repository';
import type {
  GroupCandidateRecord,
  NewGroup,
  OrganizerConversationRecord,
  OrganizerConversationRepository,
  OrganizerConversationSlice,
} from '../../business/chat/ports/organizer-conversation.repository';
import { ConversationEntity, ConversationMemberEntity } from '../entities';

/**
 * What "the organization is part of it" means, as a SQL fragment.
 *
 * The access rule of this whole file, written once and used by every statement
 * in it: two participants' `direct` conversation is not filtered out of the
 * results — it never enters them (F152, F173). Interpolated rather than
 * parameterised because it is a fixed list of literals from
 * `ORGANIZER_CONVERSATION_TYPES`, not input.
 */
const ORGANIZATION_KINDS = `c."type" IN ('group', 'organizer_contact')`;

/**
 * The overview's one statement per page (FR 3.4).
 *
 * Written out rather than assembled by the query builder, like the
 * participant's overview beside it: what this query is about is which alias
 * each column belongs to, and the reading order of the SQL is the reading
 * order of the rule.
 *
 * The `LATERAL` join is the last line of the conversation, and it answers two
 * questions in one index scan (`IDX_message_conversation`): what the row
 * previews, and — through `sender_type` — whether anybody has answered yet.
 * `left(...)` cuts the preview in the database, so a page of rows does not
 * carry a page of whole messages.
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
            FROM "conversation_member" cm
           WHERE cm."conversation_id" = c."id") AS "member_count",
         last."sender_type" AS "last_sender_type",
         last."preview"     AS "last_preview",
         last."has_image"   AS "last_has_image"
    FROM "conversation" c
    LEFT JOIN LATERAL (
      SELECT m."sender_type",
             left(btrim(m."body"), ${MESSAGE_PREVIEW_LENGTH}) AS "preview",
             m."attachment_id" IS NOT NULL AS "has_image"
        FROM "message" m
       WHERE m."conversation_id" = c."id"
       ORDER BY m."created_at" DESC, m."id" DESC
       LIMIT 1
    ) last ON TRUE
   WHERE ${ORGANIZATION_KINDS}`;

/**
 * The accounts in one conversation of the organization.
 *
 * Joined back to `conversation` for the one reason this file exists: the scope
 * has to be part of the statement, or this would be a method that answers who
 * talks to whom for any id — which is exactly what
 * {@link MessageRepository} refuses to have.
 */
const MEMBERS = `
  SELECT p."id"          AS "id",
         p."first_name"  AS "firstName",
         p."last_name"   AS "lastName",
         p."avatar_path" AS "avatarPath",
         -- The picture's ?v= is built from this, so a new avatar is a new URL.
         p."updated_at"  AS "updatedAt"
    FROM "conversation_member" cm
    JOIN "conversation" c ON c."id" = cm."conversation_id"
    JOIN "user_profile" p ON p."id" = cm."member_id"
   WHERE cm."conversation_id" = $1
     AND cm."member_type" = 'user'
     AND ${ORGANIZATION_KINDS}
   ORDER BY p."last_name" ASC, p."first_name" ASC, p."id" ASC`;

/**
 * Who may be put into a group for one event (E39).
 *
 * The address is the join, because it is the only link there is: a
 * registration carries no profile id, and an address identifies a person
 * instance-wide (E31, `unique (lower(email))`). Both sides have to be
 * confirmed — a registration that is still pending is not somebody the event
 * expects, and an account nobody confirmed cannot be logged into (E32), so
 * putting it in a group would be writing to a mailbox that never answered.
 */
const CANDIDATES = `
  SELECT p."id"         AS "profileId",
         p."first_name" AS "firstName",
         p."last_name"  AS "lastName",
         p."email"      AS "email"
    FROM "registration" r
    JOIN "user_profile" p ON lower(p."email") = lower(r."email")
   WHERE r."event_id" = $1
     AND r."status" = 'confirmed'
     AND p."confirmed_at" IS NOT NULL
   ORDER BY p."last_name" ASC, p."first_name" ASC, p."id" ASC`;

/**
 * The memberships of a new group — and the eligibility rule, in one statement.
 *
 * `INSERT … SELECT` over the same set {@link CANDIDATES} answers with, narrowed
 * to the ids the organizer picked. An id that is not a confirmed registrant of
 * this event with a confirmed account selects nothing, so it adds nobody; the
 * caller compares the count it asked for with `RETURNING` and rolls the
 * transaction back. That is the difference between a rule and a check: this
 * one cannot be reached around, not even by a second caller of this port.
 */
const INSERT_MEMBERS = `
  INSERT INTO "conversation_member"
              ("conversation_id", "member_type", "member_id")
       SELECT $1, 'user', p."id"
         FROM "registration" r
         JOIN "user_profile" p ON lower(p."email") = lower(r."email")
        WHERE r."event_id" = $2
          AND r."status" = 'confirmed'
          AND p."confirmed_at" IS NOT NULL
          AND p."id" = ANY($3::uuid[])
    RETURNING "member_id"`;

/**
 * PostgreSQL implementation of {@link OrganizerConversationRepository}.
 *
 * Every statement in this class carries {@link ORGANIZATION_KINDS} or derives
 * its rows from an event's registrations. Nothing here can read a `direct`
 * conversation, and nothing here can add somebody to a group who was not at
 * the event — both by construction rather than by a guard above (F152, F173).
 */
@Injectable()
export class TypeormOrganizerConversationRepository implements OrganizerConversationRepository {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversations: Repository<ConversationEntity>,
  ) {}

  async list(
    offset: number,
    limit: number,
  ): Promise<OrganizerConversationSlice> {
    const rows = await this.conversations.manager.query<readonly RawRow[]>(
      `${OVERVIEW}
        -- Newest activity first; a group nobody has written in sorts last,
        -- because "nothing has been said" is not news. The id breaks a shared
        -- timestamp, and is always the last criterion.
        ORDER BY c."last_message_at" DESC NULLS LAST, c."id" DESC
        OFFSET $1 LIMIT $2`,
      [offset, limit],
    );

    const total = await this.conversations
      .createQueryBuilder('c')
      .where(ORGANIZATION_KINDS)
      .getCount();

    return { rows: rows.map(fromRaw), total };
  }

  async find(
    conversationId: string,
  ): Promise<OrganizerConversationRecord | null> {
    const rows = await this.conversations.manager.query<readonly RawRow[]>(
      `${OVERVIEW} AND c."id" = $1`,
      [conversationId],
    );
    const [row] = rows;
    return row ? fromRaw(row) : null;
  }

  async membersOf(
    conversationId: string,
  ): Promise<readonly ConversationCounterpartRecord[]> {
    const rows = await this.conversations.manager.query<readonly RawMember[]>(
      MEMBERS,
      [conversationId],
    );
    return rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      avatarPath: row.avatarPath,
      updatedAt: row.updatedAt,
    }));
  }

  async groupCandidatesOf(
    eventId: string,
  ): Promise<readonly GroupCandidateRecord[]> {
    return this.conversations.manager.query<readonly GroupCandidateRecord[]>(
      CANDIDATES,
      [eventId],
    );
  }

  async createGroup(
    group: NewGroup,
  ): Promise<OrganizerConversationRecord | null> {
    const wanted = [...new Set(group.profileIds)];

    let created: { id: string } | null = null;
    try {
      created = await this.conversations.manager.transaction(
        async (manager) => {
          const conversation = await manager.save(
            manager.create(ConversationEntity, {
              type: 'group',
              // Both required for this kind by `CHK_conversation_shape`: a
              // group is about an event and carries its own subject.
              eventId: group.eventId,
              topic: group.topic,
              guestEmail: null,
              guestName: null,
              // Forbidden for anything but a direct conversation, which is
              // what makes the unique index over it mean what it says.
              directKey: null,
            }),
          );

          const added = await manager.query<readonly { member_id: string }[]>(
            INSERT_MEMBERS,
            [conversation.id, group.eventId, wanted],
          );

          // Not everybody the organizer picked was eligible, so the group is
          // not created at all — a group short of the people it was assembled
          // for would be worse than none. **Thrown**, not returned: a callback
          // that returns commits, so `return null` here would leave exactly
          // the row this refuses to create.
          if (added.length !== wanted.length) throw new Ineligible();

          return { id: conversation.id };
        },
      );
    } catch (error: unknown) {
      if (!(error instanceof Ineligible)) throw error;
      return null;
    }

    return this.find(created.id);
  }
}

/**
 * The rollback of a group whose members are not all eligible.
 *
 * An exception rather than a return value, because that is the only thing
 * TypeORM's `transaction` reads: a callback that returns commits, whatever it
 * returns. Never leaves this file — {@link
 * TypeormOrganizerConversationRepository.createGroup} turns it into the `null`
 * its port promises.
 */
class Ineligible extends Error {}

/** What {@link OVERVIEW} answers with — column names, not entity properties. */
interface RawRow {
  readonly id: string;
  readonly type: OrganizerConversationRecord['type'];
  readonly event_id: string | null;
  readonly topic: string | null;
  readonly guest_email: string | null;
  readonly guest_name: string | null;
  readonly last_message_at: Date | null;
  readonly member_count: number;
  readonly last_sender_type: MessageSenderType | null;
  readonly last_preview: string | null;
  readonly last_has_image: boolean | null;
}

/** What {@link MEMBERS} answers with — the aliases it declares. */
interface RawMember {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly avatarPath: string | null;
  readonly updatedAt: Date;
}

function fromRaw(row: RawRow): OrganizerConversationRecord {
  return {
    id: row.id,
    type: row.type,
    eventId: row.event_id,
    topic: row.topic,
    guestEmail: row.guest_email,
    guestName: row.guest_name,
    lastMessageAt: row.last_message_at,
    memberCount: Number(row.member_count),
    // `null` for a conversation with no messages: the `LATERAL` join found
    // nothing, and "nobody has written" is not an empty message.
    preview:
      row.last_sender_type === null
        ? null
        : {
            senderType: row.last_sender_type,
            // An empty string cannot happen (`CHK_message_body`), so `null`
            // here means a message that is only a picture.
            text: row.last_preview,
            hasImage: row.last_has_image === true,
          },
  };
}
