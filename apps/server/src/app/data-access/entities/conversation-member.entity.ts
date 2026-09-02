import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ConversationEntity } from './conversation.entity';

/** Which kind of account a membership belongs to (E39). */
export type ConversationMemberType = 'admin' | 'user';

/**
 * Somebody's place in a conversation (FR 4.5 — E38, E39).
 *
 * The composite primary key is the whole row's identity: a membership does not
 * exist without its conversation, and the same person is in it once. Its
 * cascade is what removes a whole conversation's memberships in one statement.
 *
 * **No foreign key on `memberId`**, and that is the one deliberate gap in this
 * schema: the column points at `admin_user` or at `user_profile` depending on
 * `memberType`. The alternative — two nullable columns with a check — buys a
 * constraint the database can enforce and costs every query a coalesce; and
 * unlike `attachment`, where an unowned file is a leak, an orphaned membership
 * is a row whose conversation is gone, which the cascade already prevents.
 *
 * `lastReadAt` is where "read" lives (E38). `null` means "has read nothing",
 * which is not the same as "read up to joining": somebody added to a group is
 * shown what was said before they arrived.
 */
@Entity({ name: 'conversation_member' })
export class ConversationMemberEntity {
  @PrimaryColumn({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @PrimaryColumn({ name: 'member_type', type: 'varchar', length: 8 })
  memberType!: ConversationMemberType;

  @PrimaryColumn({ name: 'member_id', type: 'uuid' })
  memberId!: string;

  @ManyToOne(() => ConversationEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: ConversationEntity;

  @Column({ name: 'last_read_at', type: 'timestamptz', nullable: true })
  lastReadAt!: Date | null;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;
}
