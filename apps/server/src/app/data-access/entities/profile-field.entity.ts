import type { ProfileFieldType } from '@trefaro/shared-models';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * One configurable question of the profile form (FR 4.3 — E35).
 *
 * The twin of {@link RegistrationFieldEntity} with one column missing, and the
 * missing one is the decision: there is no `event_id`. A profile belongs to the
 * person, not to an event, so this form is instance-wide — a question that has
 * to be asked differently per event belongs in the registration form, which
 * exists for exactly that.
 *
 * `key` is what an answer is stored under in
 * {@link UserProfileEntity.customFields} and never changes; `label` is what a
 * participant reads and an organizer may correct at any time (F35).
 */
@Entity({ name: 'profile_field' })
@Index(['key'], { unique: true })
export class ProfileFieldEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 80 })
  key!: string;

  @Column({ type: 'varchar', length: 200 })
  label!: string;

  /** No `file` here, unlike the registration kit — see the migration (F37). */
  @Column({ type: 'varchar', length: 16 })
  type!: ProfileFieldType;

  @Column({ name: 'help_text', type: 'varchar', length: 500, nullable: true })
  helpText!: string | null;

  /**
   * The choices of a select field; an empty array for every other type.
   *
   * Plain strings, because an option is its own value: what the participant
   * chose and what a profile view shows are then the same text, with no mapping
   * that can go stale.
   */
  @Column({ name: 'options_json', type: 'jsonb', default: () => "'[]'" })
  options!: string[];

  @Column({ type: 'boolean', default: false })
  required!: boolean;

  /**
   * Position in the form, renumbered densely on every reorder.
   *
   * Deliberately not unique: a unique constraint would make any reordering need
   * a temporary shuffle to avoid colliding with itself, and the order is
   * rewritten as a whole anyway.
   */
  @Column({ type: 'int', default: 0 })
  sort!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
