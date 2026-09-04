import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventSeriesEntity } from './event-series.entity';

/**
 * A newsletter sign-up made in the app (FR 4.8, E45).
 *
 * The second of the two sources an organization's address list has, and the one
 * that needs neither an event nor an account. The first source is
 * `registration.newsletter_opt_in` and stays where it is: a checkbox in a form
 * somebody filled in for an event.
 *
 * A row is a **request** until `confirmed_at` is set and a **consent**
 * afterwards. The overview lists consents only, which is what makes the double
 * opt-in mean something (E45) — an address somebody else typed into the form is
 * never on a list until the person behind it clicked.
 *
 * Nothing here is written by an organizer, and nothing sends: v1 has no
 * newsletter dispatch (F8). This table is what an organization exports into the
 * tool it already sends with.
 */
@Entity({ name: 'newsletter_subscription' })
export class NewsletterSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Stored in lower case, like `registration.email` and unlike a profile's.
   *
   * A profile keeps the spelling its owner typed because it belongs to them;
   * this row belongs to a list, and the list is read as one set of addresses
   * over both sources — which the overview can only do if both are spelled the
   * same way. The unique index is on `lower(email)` together with the series
   * and carries `NULLS NOT DISTINCT`, so one address has at most one consent
   * per series and at most one instance-wide.
   */
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  /**
   * The series this sign-up is about, or `null` for the whole instance.
   *
   * Both branches are written: the start page's form has no series, a series
   * page's form has one. The overview says which — that is the column's reader.
   */
  @Column({ name: 'event_series_id', type: 'uuid', nullable: true })
  seriesId!: string | null;

  @ManyToOne(() => EventSeriesEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'event_series_id' })
  series?: EventSeriesEntity | null;

  /** `null` while the confirmation link is still unclicked (E45). */
  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /**
   * Moved when a sign-up is repeated for an address that never confirmed.
   *
   * A repeat is not a second row (the unique index would refuse it) and not a
   * second consent — it is somebody asking for the mail again, which is worth
   * a timestamp and nothing else.
   */
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
