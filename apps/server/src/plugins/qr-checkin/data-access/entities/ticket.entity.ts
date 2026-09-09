import { MAX_CHECKIN_CODE_LENGTH } from '@trefaro/shared-models';
import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * One admission ticket (FR 3.16): the code a person brings, and whether they
 * have arrived.
 *
 * **The registration is the primary key.** One registration, one code, one
 * state — a surrogate id would allow two rows for one person at one door, and
 * then the question "is this ticket the current one?" would need an answer
 * nobody has. It is a real foreign key with `ON DELETE CASCADE`: the ticket
 * belongs to the registration and goes with it, which is what a plug-in's own
 * table may declare towards a core table (F21) — it binds the plug-in, not the
 * core.
 *
 * **One table, not two.** `checked_in_at` NULL means "not here yet", the same
 * shape `confirmed_at` has on the registration itself (E32). Splitting code and
 * attendance would be two truths about one person at one door.
 *
 * **`checked_in_by` is `SET NULL`**, like every decision this application
 * records: whoever opened the door may leave the organization, and losing the
 * fact that somebody was let in along with their account would rewrite history.
 *
 * No `updated_at`. There are exactly two writes in this row's life — it is
 * issued, and it is read at the door — and both have their own column.
 */
@Entity({ name: 'plugin_qr_checkin_ticket' })
export class TicketEntity {
  @PrimaryColumn({ name: 'registration_id', type: 'uuid' })
  registrationId!: string;

  /**
   * The opaque code (E53).
   *
   * Never the signed self-service token: that one can cancel a registration
   * (F44), and a QR code is photographed, held up at a door and mirrored on
   * screens. Unique across the instance, so a scan resolves without knowing
   * which event it belongs to — which is what a door needs when two events run
   * on one day.
   */
  @Column({ type: 'varchar', length: MAX_CHECKIN_CODE_LENGTH, unique: true })
  code!: string;

  @Column({ name: 'issued_at', type: 'timestamptz' })
  issuedAt!: Date;

  /** `null` while they have not arrived. */
  @Column({ name: 'checked_in_at', type: 'timestamptz', nullable: true })
  checkedInAt!: Date | null;

  /** Who let them in, or `null` if that account is gone. */
  @Column({ name: 'checked_in_by', type: 'uuid', nullable: true })
  checkedInBy!: string | null;
}
