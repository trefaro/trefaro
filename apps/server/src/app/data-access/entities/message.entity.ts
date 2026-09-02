import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { MessageSenderType } from '@trefaro/shared-models';
import { AttachmentEntity } from './attachment.entity';
import { ConversationEntity } from './conversation.entity';

/**
 * One line of a conversation (FR 4.5 — E40).
 *
 * Text, picture or both, and the database says so: `CHK_message_content`
 * refuses a row with neither, and `CHK_message_body` refuses a body of
 * whitespace. There is no `updated_at` and no soft-delete flag, and that is
 * E14 read the strict way — a message that can be rewritten after it was read
 * makes the conversation above it a different conversation.
 *
 * `attachment` is reached with `ON DELETE SET NULL`: a removed file does not
 * remove what somebody wrote. The reverse — the file of a removed message —
 * is nobody's cascade, because nothing removes a message.
 */
@Entity({ name: 'message' })
export class MessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => ConversationEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: ConversationEntity;

  @Column({ name: 'sender_type', type: 'varchar', length: 8 })
  senderType!: MessageSenderType;

  /** `null` exactly for a guest, who has no account to point at (E39). */
  @Column({ name: 'sender_id', type: 'uuid', nullable: true })
  senderId!: string | null;

  @Column({ name: 'body', type: 'text', nullable: true })
  body!: string | null;

  @Column({ name: 'attachment_id', type: 'uuid', nullable: true })
  attachmentId!: string | null;

  @ManyToOne(() => AttachmentEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'attachment_id' })
  attachment!: AttachmentEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
