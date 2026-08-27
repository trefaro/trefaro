import type { EventStatus, EventType } from '@trefaro/shared-models';
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
import { EventSeriesEntity } from './event-series.entity';

/**
 * An event inside a series (FR 3.1, FR 3.2, FR 3.9).
 *
 * `starts_at` and `ends_at` are absolute instants; `timezone` says which zone
 * they are meant to be read in (E8). Storing a wall-clock time instead would
 * make "when does it start" unanswerable for anyone not standing at the venue.
 */
@Entity({ name: 'event' })
// Declared here because it is part of the model, but the migration owns it as
// `UQ_event_slug_in_series` — this instance never synchronizes a schema.
@Index(['seriesId', 'slug'], { unique: true })
export class EventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'series_id', type: 'uuid' })
  seriesId!: string;

  @ManyToOne(() => EventSeriesEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'series_id' })
  series!: EventSeriesEntity;

  /** Readable part of the public URL; unique within the series, not globally. */
  @Column({ type: 'varchar', length: 80 })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  /** Path inside the upload volume — the upload itself arrives in AP 7. */
  @Column({ name: 'logo_path', type: 'varchar', length: 512, nullable: true })
  logoPath!: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 16 })
  eventType!: EventType;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt!: Date;

  /** IANA zone of the venue, e.g. `Europe/Berlin`. */
  @Column({ type: 'varchar', length: 64 })
  timezone!: string;

  @Column({ name: 'venue_name', type: 'varchar', length: 200, nullable: true })
  venueName!: string | null;

  @Column({ name: 'venue_address', type: 'text', nullable: true })
  venueAddress!: string | null;

  @Column({ name: 'online_url', type: 'varchar', length: 512, nullable: true })
  onlineUrl!: string | null;

  /** BCP 47 tags; a Postgres array rather than JSON, so it stays queryable. */
  @Column({ type: 'varchar', length: 16, array: true })
  languages!: string[];

  @Column({ type: 'varchar', length: 16 })
  status!: EventStatus;

  /**
   * What participants read once the event is over (FR 3.6, UC 10).
   *
   * `text`, because a follow-up is prose rather than a field, and nullable
   * because most events never get one. Whether it is *shown* is not stored: the
   * event's own end decides that, and the business layer withholds it until then
   * (F50).
   */
  @Column({ name: 'follow_up_body', type: 'text', nullable: true })
  followUpBody!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
