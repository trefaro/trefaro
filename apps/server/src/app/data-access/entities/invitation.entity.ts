import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EventSeriesEntity } from './event-series.entity';
import { EventEntity } from './event.entity';

/**
 * One message sent to former participants of a series (FR 2.4, F24).
 *
 * The message, not its audience: who received it is `invitation_recipient`, and
 * those rows point at registrations rather than carrying addresses (F55). What
 * this row is for afterwards is the organization's record of having written to
 * people — which is why it has no `updated_at`: an invitation is not edited, it
 * is sent.
 *
 * `eventId` is what the invitation invites to and may be `null`: the event may
 * have been deleted since (`ON DELETE SET NULL`), or the message may not have
 * named one at all.
 */
@Entity({ name: 'invitation' })
// Declared here because it is part of the model; the migration owns it as
// `IDX_invitation_series_created_at`. This instance never synchronizes a schema.
@Index(['seriesId', 'createdAt', 'id'])
export class InvitationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'series_id', type: 'uuid' })
  seriesId!: string;

  @ManyToOne(() => EventSeriesEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'series_id' })
  series!: EventSeriesEntity;

  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId!: string | null;

  @ManyToOne(() => EventEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'event_id' })
  event!: EventEntity | null;

  @Column({ type: 'varchar', length: 200 })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** Set once no recipient of this invitation is pending any more. */
  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;
}
