import type { RegistrationStatus } from '@trefaro/shared-models';
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
 * One person's registration for one event (FR 3.5).
 *
 * `email` is stored lower-cased and trimmed, because the uniqueness rule is per
 * event and address (E10) and two rows for the same person would corrupt the one
 * screen the survey rated highest — the participant overview (FR 3.3).
 */
@Entity({ name: 'registration' })
// The migration owns the real thing as a unique index over `lower(email)`; this
// instance never synchronizes a schema, and the column is normalized on write.
@Index(['eventId', 'email'], { unique: true })
export class RegistrationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @ManyToOne(() => EventEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: EventEntity;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  /** Country, city or organization — free text, the organizer decides. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  origin!: string | null;

  /**
   * Values of the configurable fields (F12).
   *
   * The column exists from the start so AP 6 adds definitions rather than a
   * migration on a table that already holds registrations.
   */
  @Column({ name: 'custom_fields_json', type: 'jsonb', default: () => "'{}'" })
  customFields!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 16 })
  status!: RegistrationStatus;

  @Column({ name: 'newsletter_opt_in', type: 'boolean', default: false })
  newsletterOptIn!: boolean;

  /** Set when the participant objects to invitations to later events (E15). */
  @Column({ name: 'contact_opt_out', type: 'boolean', default: false })
  contactOptOut!: boolean;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
