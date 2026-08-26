import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A browser's Web Push subscription (FR 3.15).
 *
 * Self-hosted push via VAPID — no Firebase or other third-party push service
 * (NFR 9). The endpoint is the push service URL the browser handed us; the two
 * keys encrypt the payload so the push service cannot read it.
 *
 * There is no `user_id` yet: user profiles arrive in phase 3, and the column is
 * added together with its foreign key in that migration.
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

  /** Kept for diagnostics only — helps tell an expired iOS PWA from a desktop tab. */
  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
