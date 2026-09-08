import type { ForumPostStatus } from '@trefaro/shared-models';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ThreadEntity } from './thread.entity';

/**
 * A forum post (FR 4.6): one contribution to a thread, and the thing an
 * organizer decides on (E51).
 *
 * Three columns point outside the plug-in's own thread table — the author and
 * whoever decided — and both carry a real foreign key: the author with
 * `CASCADE` (a closed account takes what it wrote; a post is attributed by
 * nature, E58), the decider with `SET NULL` (an organizer's account may be
 * closed, and losing the decision along with it would rewrite history).
 *
 * **No `updated_at`**, like a chat message (E40): a post cannot be edited, so
 * there is nothing for the column to say. A post that could be rewritten after
 * it was read would make the thread about it a different thread.
 */
@Entity({ name: 'plugin_forum_post' })
// Reading a thread: its posts in the order they were written.
@Index(['threadId', 'createdAt'])
export class PostEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'thread_id', type: 'uuid' })
  threadId!: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: ForumPostStatus;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /**
   * The thread this post is in, when a query joined it.
   *
   * Not a column and not a relation the ORM manages: the moderation list maps
   * the joined thread here (`innerJoinAndMapOne`) so that each row can say
   * which thread it belongs to. Everywhere else it is absent.
   */
  thread?: ThreadEntity;
}
