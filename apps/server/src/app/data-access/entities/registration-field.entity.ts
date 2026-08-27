import type { RegistrationFieldType } from '@trefaro/shared-models';
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
 * One configurable field of one event's registration form (F12, FR 3.5).
 *
 * `key` is what an answer is stored under in
 * {@link RegistrationEntity.customFields} and never changes; `label` is what a
 * participant reads and an organizer may correct at any time. Keeping the two
 * apart is what lets a question be rephrased without orphaning the answers
 * already given.
 */
@Entity({ name: 'registration_field_def' })
@Index(['eventId', 'key'], { unique: true })
export class RegistrationFieldEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @ManyToOne(() => EventEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: EventEntity;

  @Column({ type: 'varchar', length: 80 })
  key!: string;

  @Column({ type: 'varchar', length: 200 })
  label!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: RegistrationFieldType;

  @Column({ name: 'help_text', type: 'varchar', length: 500, nullable: true })
  helpText!: string | null;

  /**
   * The choices of a select field; an empty array for every other type.
   *
   * Plain strings, because an option is its own value: what the participant
   * chose and what the overview shows are then the same text, with no mapping
   * that can go stale.
   */
  @Column({ name: 'options_json', type: 'jsonb', default: () => "'[]'" })
  options!: string[];

  @Column({ type: 'boolean', default: false })
  required!: boolean;

  /**
   * Position in the form, renumbered densely on every reorder.
   *
   * Deliberately not unique per event: a unique constraint would make any
   * reordering need a temporary shuffle to avoid colliding with itself, and the
   * order is rewritten as a whole anyway.
   */
  @Column({ type: 'int', default: 0 })
  sort!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
