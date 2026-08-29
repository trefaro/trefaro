import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProgramItemEntity } from './program-item.entity';

/**
 * What one session says in one other language (FR 3.12, E25).
 *
 * `speaker` has no second value: a person's name is not translated, it is
 * transliterated at most, and an organizer who needs a different spelling in a
 * different script is asking for something this table cannot tell apart from a
 * typo.
 *
 * Times are absent for the same reason as everywhere else — an instant is one
 * instant, rendered in the event's zone (E8) and in the reader's language
 * (F78). Translating a clock would be translating a fact.
 */
@Entity({ name: 'program_item_translation' })
export class ProgramItemTranslationEntity {
  @PrimaryColumn({ name: 'program_item_id', type: 'uuid' })
  programItemId!: string;

  @PrimaryColumn({ type: 'varchar', length: 16 })
  locale!: string;

  @ManyToOne(() => ProgramItemEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_item_id' })
  programItem!: ProgramItemEntity;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title!: string | null;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  description!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
