import type { ProposalStatus } from '@trefaro/shared-models';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A programme proposal (FR 3.13, FR 3.14).
 *
 * Owned entirely by the plug-in: the table is created and dropped by the
 * plug-in's own migration, and no core migration knows it exists (F21).
 *
 * Three of its columns point at core tables — the event, the author and whoever
 * decided — and all three carry a real foreign key. That constrains the
 * plug-in, not the core, which is the direction F21 allows: the plug-in's
 * migration is stamped after the core migrations that create those tables, and
 * the cascades mean an event deleted with its proposals leaves nothing behind.
 * `decided_by` is the exception that sets null instead: an organizer's account
 * may be closed, and losing the decision along with it would rewrite history.
 */
@Entity({ name: 'plugin_program_proposals_proposal' })
// The moderation list: one event, one status, newest first.
@Index(['eventId', 'status', 'createdAt'])
// "My proposals", which is the other direction the same rows are read in.
@Index(['authorId', 'createdAt'])
export class ProposalEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: ProposalStatus;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
