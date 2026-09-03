import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ConversationMemberRef } from '../../business/chat/ports/conversation.repository';
import type {
  AppendedMessage,
  MessageImageRecord,
  MessageRecord,
  MessageRepository,
  NewMessage,
} from '../../business/chat/ports/message.repository';
import {
  AttachmentEntity,
  ConversationEntity,
  ConversationMemberEntity,
  MessageEntity,
} from '../entities';

/**
 * One window of a conversation, newest first (FR 4.5).
 *
 * The cursor is a row comparison against the message it names, which is what
 * makes it exact where a timestamp would not be: two messages can share a
 * millisecond, and `(created_at, id) < (…)` orders them anyway. The subquery
 * is scoped to the same conversation, so an id from somewhere else — or one
 * that no longer exists — yields `NULL` and therefore an empty window rather
 * than a hint that it exists.
 */
const HISTORY = `
  SELECT m."id",
         m."conversation_id",
         m."sender_type",
         m."sender_id",
         m."body",
         (m."attachment_id" IS NOT NULL) AS "has_image",
         m."created_at"
    FROM "message" m
   WHERE m."conversation_id" = $1
     AND ($2::uuid IS NULL
          OR (m."created_at", m."id") <
             (SELECT c."created_at", c."id"
                FROM "message" c
               WHERE c."id" = $2::uuid
                 AND c."conversation_id" = $1))
   ORDER BY m."created_at" DESC, m."id" DESC
   LIMIT $3`;

/**
 * PostgreSQL implementation of {@link MessageRepository} (FR 4.5 — E40).
 *
 * The one thing worth naming is what {@link append} does in a single
 * transaction: the `attachment` row of a picture and the `message` row that
 * points at it are written together. `CHK_attachment_owner` can say that an
 * attachment without a registration carries no field key, but no constraint
 * can say that a message points at it — so the transaction is what rules out
 * an attachment row nobody references. It also moves the conversation's
 * `last_message_at`, because a message that did not reorder the overview would
 * be a message somebody has to scroll to find — and it reads the memberships,
 * so that delivery reaches whoever was in the conversation when the line was
 * written (E41).
 */
@Injectable()
export class TypeormMessageRepository implements MessageRepository {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messages: Repository<MessageEntity>,
  ) {}

  async append(message: NewMessage): Promise<AppendedMessage> {
    return this.messages.manager.transaction(async (manager) => {
      let attachmentId: string | null = null;

      if (message.image) {
        const attachment = await manager.save(
          manager.create(AttachmentEntity, {
            // No registration and no field key: a picture in a conversation
            // answers no form question (CHK_attachment_owner, E40).
            registrationId: null,
            fieldKey: null,
            path: message.image.path,
            fileName: message.image.fileName,
            mimeType: message.image.mimeType,
            sizeBytes: message.image.sizeBytes,
          }),
        );
        attachmentId = attachment.id;
      }

      const saved = await manager.save(
        manager.create(MessageEntity, {
          conversationId: message.conversationId,
          senderType: message.senderType,
          senderId: message.senderId,
          body: message.body,
          attachmentId,
        }),
      );

      // The sort order of the overview, moved in the same transaction as the
      // line that justifies it.
      await manager.update(
        ConversationEntity,
        { id: message.conversationId },
        { lastMessageAt: saved.createdAt },
      );

      // In the same transaction, and after the write rather than before it:
      // whoever is a member when the line lands is who the line is for.
      const members = await manager.find(ConversationMemberEntity, {
        where: { conversationId: message.conversationId },
        select: { memberType: true, memberId: true },
      });

      return {
        record: {
          id: saved.id,
          conversationId: saved.conversationId,
          senderType: saved.senderType,
          senderId: saved.senderId,
          body: saved.body,
          hasImage: attachmentId !== null,
          createdAt: saved.createdAt,
        },
        members: members.map((row): ConversationMemberRef => ({
          memberType: row.memberType,
          memberId: row.memberId,
        })),
      };
    });
  }

  async history(
    conversationId: string,
    before: string | null,
    limit: number,
  ): Promise<readonly MessageRecord[]> {
    const rows = await this.messages.manager.query<readonly RawMessage[]>(
      HISTORY,
      [conversationId, before, limit],
    );
    return rows.map(fromRaw);
  }

  async findImage(messageId: string): Promise<MessageImageRecord | null> {
    const row = await this.messages
      .createQueryBuilder('message')
      .innerJoin(
        AttachmentEntity,
        'attachment',
        'attachment.id = message.attachment_id',
      )
      .select('message.conversation_id', 'conversationId')
      .addSelect('attachment.file_path', 'path')
      .where('message.id = :messageId', { messageId })
      .getRawOne<MessageImageRecord>();
    return row ?? null;
  }
}

/** What {@link HISTORY} answers with — column names, not entity properties. */
interface RawMessage {
  readonly id: string;
  readonly conversation_id: string;
  readonly sender_type: MessageRecord['senderType'];
  readonly sender_id: string | null;
  readonly body: string | null;
  readonly has_image: boolean;
  readonly created_at: Date;
}

function fromRaw(row: RawMessage): MessageRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderType: row.sender_type,
    senderId: row.sender_id,
    body: row.body,
    hasImage: row.has_image,
    createdAt: row.created_at,
  };
}
