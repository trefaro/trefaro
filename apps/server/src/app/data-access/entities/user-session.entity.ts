import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserProfileEntity } from './user-profile.entity';

/**
 * A live participant session (E34).
 *
 * The same shape as `admin_session` and for the same reasons: only the SHA-256
 * hash of the token is stored, and the foreign key cascades so deleting a
 * profile ends its sessions in the same statement. A second table rather than a
 * role column on one — an organizer who is also a participant holds both at
 * once, and a single cookie carrying a role would decide authorization in the
 * browser.
 *
 * No `user_agent`: nothing shows a participant a list of their sessions, and the
 * administrative column exists for that list alone.
 */
@Entity({ name: 'user_session' })
export class UserSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserProfileEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: UserProfileEntity;

  /** Hex-encoded SHA-256 — fixed width, hence `char`. */
  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt!: Date;

  /** Idle deadline: every request slides it forward. */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
