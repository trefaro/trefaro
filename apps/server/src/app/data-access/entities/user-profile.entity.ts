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

  /**
   * Where the profile picture is, relative to the upload volume (F124).
   *
   * `NULL` or a path below `avatars/`, and the database holds that line
   * (`CHK_user_profile_avatar_path`): the neighbours of a stored path are
   * registration attachments (E9). Written only through `setAvatarPath`, never
   * as part of a profile form — a form that can empty a path column empties it
   * by accident eventually (F116).
   */
  @Column({ name: 'avatar_path', type: 'varchar', length: 512, nullable: true })
  avatarPath!: string | null;

  /**
   * What this person works on, as free text (E36).
   *
   * Its own column rather than a question in the field kit, because the
   * participant search filters on it (FR 4.4) — and a criterion inside
   * `custom_fields_json` is not one that can be compared reliably.
   */
  @Column({
    name: 'activity_areas',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  activityAreas!: string | null;

  /** The answers to this instance's profile questions, by field key (E35). */
  @Column({ name: 'custom_fields_json', type: 'jsonb', default: () => "'{}'" })
  customFields!: Record<string, string | boolean>;

  /**
   * Whether this profile may be found — and written to (E37, F13).
   *
   * One switch with one meaning: a one-to-one conversation can only start with
   * a profile that is in the search, so withdrawing it takes the person out of
   * both. Off by default, because being findable is a decision its owner makes.
   */
  @Column({ type: 'boolean', default: false })
  searchable!: boolean;

  /** `null` until the double opt-in was answered (E32) — no session before it. */
  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
