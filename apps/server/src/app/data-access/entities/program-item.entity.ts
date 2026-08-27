import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventEntity } from './event.entity';

/**
 * One session of one event's programme (FR 3.7).
 *
 * Two columns the schema draft had are deliberately absent:
 *
 * - **`room_id`** — the room a session happens in belongs to the room planning
 *   plug-in's own join table (F21). A plug-in does not add columns to a core
 *   table, and this is the column that made the draft say otherwise.
 * - **`sort`** — a programme is ordered by the clock (F40). A position column
 *   beside `starts_at` would be a second ordering that can disagree with the
 *   first.
 *
 * `registration_enabled` and `capacity` arrive with the per-item sign-up in
 * AP 9, together with the table that gives them a meaning. A flag nothing reads
 * looks like a feature that exists.
 */
@Entity({ name: 'program_item' })
@Index(['eventId', 'startsAt', 'endsAt', 'id'])
export class ProgramItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @ManyToOne(() => EventEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: EventEntity;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  description!: string | null;

  /** A name, not an account: a speaker need not be a registered participant. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  speaker!: string | null;

  /**
   * Absolute instants; the zone they are read in hangs on the event (E8).
   *
   * A programme item has no zone of its own — it happens where the event
   * happens, and two items of one event disagreeing about the zone would be
   * unreadable.
   */
  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
