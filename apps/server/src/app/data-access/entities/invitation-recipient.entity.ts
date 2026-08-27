import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { InvitationEntity } from './invitation.entity';
import { RegistrationEntity } from './registration.entity';

/** Where one recipient of an invitation stands. @see InvitationRecipientEntity */
export type InvitationRecipientStatus = 'pending' | 'sent' | 'failed';

/**
 * One address an invitation went to — named by its registration (F55).
 *
 * There is no `email` column, deliberately: the address is read through the
 * foreign key when the mail is composed, so this feature keeps no second copy
 * of anybody's contact details, and an erased registration takes its place in
 * every past invitation with it.
 *
 * The row is also the send queue. `pending` is what the sender asks for one at
 * a time; `sent` and `failed` are what it writes back. The invitation's overall
 * state is counted from these rows rather than stored beside them, so the two
 * cannot disagree after a crash.
 */
@Entity({ name: 'invitation_recipient' })
@Unique(['invitationId', 'registrationId'])
// Declared here because they are part of the model; the migration owns them as
// `IDX_invitation_recipient_pending` (partial) and `…_invitation`.
@Index(['invitationId', 'status'])
export class InvitationRecipientEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'invitation_id', type: 'uuid' })
  invitationId!: string;

  @ManyToOne(() => InvitationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invitation_id' })
  invitation!: InvitationEntity;

  @Column({ name: 'registration_id', type: 'uuid' })
  registrationId!: string;

  @ManyToOne(() => RegistrationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'registration_id' })
  registration!: RegistrationEntity;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: InvitationRecipientStatus;

  /** Why the mail server refused it — read by the organizer, so kept short. */
  @Column({ type: 'text', nullable: true })
  failure!: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;
}
