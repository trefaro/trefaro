import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { EventSeriesStatus } from '@trefaro/shared-models';

/**
 * An event series (FR 2.1, FR 2.2) — the unit an organization plans in.
 *
 * `status` is a `varchar` with a check constraint rather than a PostgreSQL
 * enum (E6): adding a value later is one line of migration instead of a type
 * rewrite, and the value stays readable when an organization's own admin looks
 * at the table.
 */
@Entity({ name: 'event_series' })
export class EventSeriesEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Readable part of the public URL; unique across the instance. */
  @Column({ type: 'varchar', length: 80, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  /** Path inside the upload volume — the upload itself arrives in AP 7. */
  @Column({ name: 'logo_path', type: 'varchar', length: 512, nullable: true })
  logoPath!: string | null;

  @Column({ name: 'website_url', type: 'varchar', length: 512, nullable: true })
  websiteUrl!: string | null;

  @Column({
    name: 'contact_email',
    type: 'varchar',
    length: 320,
    nullable: true,
  })
  contactEmail!: string | null;

  @Column({ type: 'varchar', length: 16 })
  status!: EventSeriesStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
