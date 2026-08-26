import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AdminUserEntity } from './admin-user.entity';

/**
 * A live administrative session (F22).
 *
 * Only the SHA-256 hash of the session token is stored: a stolen database dump
 * must not hand over working sessions. The foreign key cascades, so deleting an
 * administrator ends their sessions in the same statement — which is the reason
 * sessions are rows here instead of self-contained tokens.
 */
@Entity({ name: 'admin_session' })
export class AdminSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'admin_user_id', type: 'uuid' })
  adminUserId!: string;

  @ManyToOne(() => AdminUserEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'admin_user_id' })
  adminUser!: AdminUserEntity;

  /** Hex-encoded SHA-256 — fixed width, hence `char`. */
  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  /** Diagnostics only: helps an organizer recognise their own sessions. */
  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt!: Date;

  /** Idle deadline: every request slides it forward.  */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}
