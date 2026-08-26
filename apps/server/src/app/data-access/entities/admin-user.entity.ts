import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * An administrator of the instance (FR 1.2).
 *
 * Uniqueness of the address is a **case-insensitive** unique index declared in
 * the migration; TypeORM cannot express a functional index here, and the
 * migration is the schema authority anyway.
 */
@Entity({ name: 'admin_user' })
export class AdminUserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stored as entered so mail keeps the spelling the person chose. */
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  /** argon2id, encoded with its parameters — never leaves the server. */
  @Column({ name: 'password_hash', type: 'varchar', length: 256 })
  passwordHash!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /** `null` for an account that has never been used. */
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;
}
