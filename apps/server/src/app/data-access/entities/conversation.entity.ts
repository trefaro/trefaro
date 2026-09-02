import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ConversationType } from '@trefaro/shared-models';
import { EventEntity } from './event.entity';

/**
 * One conversation (FR 4.5 — E39).
 *
 * Three kinds in one table rather than three tables, because everything about
 * them is the same: the members, the messages, the unread count, the sort
 * order. What differs is who the second side is — another account, a group
 * around an event, or somebody without an account at all — and that is a
 * column plus a check constraint, not a schema.
 *
 * `lastMessageAt` is the overview's sort order and the one piece of derived
 * data kept here. A counter of unread messages is deliberately **not** beside
 * it: unread is per member and gets counted (E38, F56), and a stored counter is
 * the kind of number that goes wrong quietly.
 */
@Entity({ name: 'conversation' })
export class ConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'type', type: 'varchar', length: 24 })
  type!: ConversationType;

  /** A group's event; `null` for the other two kinds. */
  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId!: string | null;

  @ManyToOne(() => EventEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'event_id' })
  event!: EventEntity | null;

  /** A group's subject. A direct conversation is named by who it is with. */
  @Column({ name: 'topic', type: 'varchar', length: 200, nullable: true })
  topic!: string | null;

  /** The address of somebody without an account (E39) — never an account row. */
  @Column({ name: 'guest_email', type: 'varchar', length: 320, nullable: true })
  guestEmail!: string | null;

  @Column({ name: 'guest_name', type: 'varchar', length: 200, nullable: true })
  guestName!: string | null;

  /**
   * The two profile ids of a direct conversation, smaller one first.
   *
   * Written and read here and nowhere else: it exists so a unique index can say
   * "two accounts have one direct conversation", which no constraint over
   * `conversation_member` could. The business layer asks for "the conversation
   * of these two, creating it if there is none" and never sees this.
   */
  @Column({ name: 'direct_key', type: 'varchar', length: 80, nullable: true })
  directKey!: string | null;

  /** `null` while nobody has written — a conversation may be empty. */
  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
