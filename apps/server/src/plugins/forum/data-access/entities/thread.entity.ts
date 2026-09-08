import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A forum thread (FR 4.6): one topic of one event's forum.
 *
 * Owned entirely by the plug-in: the table is created and dropped by the
 * plug-in's own migration, and no core migration knows it exists (F21). Two of
 * its columns point at core tables — the event and whoever opened it — and both
 * carry a real foreign key with `CASCADE`, which constrains the plug-in and not
 * the core.
 *
 * **No status column** (F195). A thread is visible as soon as one of its posts
 * is approved, and to whoever wrote in it; a status of its own would be a
 * second moderation surface for the same decision.
 *
 * `last_post_at` is the moment of the latest **published** post, or the
 * thread's creation while there is none — recomputed by the repository on every
 * decision, never incremented on a post's arrival. The list is sorted by it,
 * and a reader must not see a thread move because of a post they cannot read.
 */
@Entity({ name: 'plugin_forum_thread' })
// The thread list: one event, latest published activity first.
@Index(['eventId', 'lastPostAt'])
export class ThreadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'last_post_at', type: 'timestamptz', default: () => 'now()' })
  lastPostAt!: Date;
}
