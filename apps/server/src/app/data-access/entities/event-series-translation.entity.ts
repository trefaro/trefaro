import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventSeriesEntity } from './event-series.entity';

/**
 * What one series says in one other language (FR 3.12, E25).
 *
 * The composite key `(series_id, locale)` is the natural one: a translation is
 * identified by what it translates and what language it is in. Every text column
 * is nullable and means "use the original" when it is `null` — a translation is
 * field by field, so an organizer may translate a name today and the description
 * next week without the page showing a hole in between.
 *
 * No foreign key to the offered languages, for the same reason
 * `translation_override` has none: a language exists because somebody translated
 * something into it, and taking it out of `active_locales` must not delete the
 * work.
 */
@Entity({ name: 'event_series_translation' })
export class EventSeriesTranslationEntity {
  @PrimaryColumn({ name: 'series_id', type: 'uuid' })
  seriesId!: string;

  @PrimaryColumn({ type: 'varchar', length: 16 })
  locale!: string;

  @ManyToOne(() => EventSeriesEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'series_id' })
  series!: EventSeriesEntity;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
