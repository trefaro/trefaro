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
 * A browser's Web Push subscription (FR 3.15).
 *
 * Self-hosted push via VAPID — no Firebase or other third-party push service
 * (NFR 9). The endpoint is the push service URL the browser handed us; the two
 * keys encrypt the payload so the push service cannot read it.
 *
 * **Whose it is, if anybody's** (E43). `user_id` was left out of the phase 0
 * schema on purpose — there was no `user_profile` to point at, and a column
 * without its foreign key is one the database cannot keep honest. AP 11 of
 * phase 3 adds both, nullable: a browser that never made an account keeps its
 * subscription and keeps getting what is public about an event. What an account
 * adds is the *personal* half — a new message goes only to devices that have
 * one.
 */
@Entity({ name: 'push_subscription' })
export class PushSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Unique: re-subscribing the same browser must update, not duplicate. */
  @Column({ type: 'text', unique: true })
  endpoint!: string;

  @Column({ name: 'p256dh_key', type: 'text' })
  p256dhKey!: string;

  @Column({ name: 'auth_key', type: 'text' })
  authKey!: string;

  /**
   * The account this browser is signed in to, or `null` (E43).
   *
   * Set from the session that posted the subscription, which is why signing in
   * and signing out both re-post it: the endpoint is the identity of the row,
   * so a device is *rebound* rather than duplicated. `null` after signing out
   * is the point — a shared tablet must stop delivering one person's messages
   * the moment they leave.
   */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => UserProfileEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: UserProfileEntity | null;

  /** Kept for diagnostics only — helps tell an expired iOS PWA from a desktop tab. */
  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
