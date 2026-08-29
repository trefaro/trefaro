import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventEntity } from './event.entity';

/**
 * What one event says in one other language (FR 3.12, E25).
 *
 * Four of the event's columns have a second value here, and two that a reader
 * might expect deliberately do not:
 *
 * - **`venue_address`** — a street is the same street in every language, and a
 *   translated one sends people to a place that does not exist.
 * - **`languages`** — the languages an event is *held* in (FR 3.1) is a fact
 *   about the event, not a rendering of it. An English-language conference may
 *   perfectly well have a German landing page, which is exactly why the two are
 *   separate.
 *
 * `venue_name` does have one: "Town Hall" and „Rathaus" name the same building
 * and a participant looks for the word they know.
 */
@Entity({ name: 'event_translation' })
export class EventTranslationEntity {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @PrimaryColumn({ type: 'varchar', length: 16 })
  locale!: string;

  @ManyToOne(() => EventEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: EventEntity;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'venue_name', type: 'varchar', length: 200, nullable: true })
  venueName!: string | null;

  @Column({ name: 'follow_up_body', type: 'text', nullable: true })
  followUpBody!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
