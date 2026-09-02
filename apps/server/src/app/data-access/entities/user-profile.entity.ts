import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A participant's account and profile (FR 4.1, FR 4.3 — E31).
 *
 * The address is the identity: unique instance-wide, compared without regard to
 * case, and never changed. There is deliberately no relation to `registration`
 * — the registrations of this person are the ones carrying the same address
 * (E31), which is what lets the rows written before there were accounts belong
 * to somebody the day their owner signs up.
 */
@Entity({ name: 'user_profile' })
export class UserProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stored as entered, compared case-insensitively (`UQ_user_profile_email`). */
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 256 })
  passwordHash!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  /** BCP 47 tag; the language this person is written to in (F90). */
  @Column({ name: 'preferred_locale', type: 'varchar', length: 16 })
  preferredLocale!: string;

  /** `null` until the double opt-in was answered (E32) — no session before it. */
  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
