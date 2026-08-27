import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ProgramItemEntity } from './program-item.entity';
import { RegistrationEntity } from './registration.entity';

/**
 * One person's seat in one session (FR 3.10).
 *
 * A row of its own rather than a list on either side, because both directions
 * are read: the self-service page asks "what have I signed up for" and the
 * organizer asks "who is coming to this workshop".
 *
 * Both foreign keys cascade. Deleting a session frees the seats it held;
 * deleting a registration takes the seats that person claimed — which is what
 * makes "delete my data" a single statement rather than a cleanup routine
 * somebody has to remember (E14, and the erasure functions of phase 5).
 *
 * No status column: a sign-up either exists or it does not. Cancelling one is
 * deleting the row, and a cancelled seat that stayed visible would be a seat
 * the next person could not take.
 */
@Entity({ name: 'program_item_signup' })
@Unique('UQ_program_item_signup', ['programItemId', 'registrationId'])
@Index(['registrationId'])
export class ProgramItemSignupEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'program_item_id', type: 'uuid' })
  programItemId!: string;

  @ManyToOne(() => ProgramItemEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_item_id' })
  programItem!: ProgramItemEntity;

  @Column({ name: 'registration_id', type: 'uuid' })
  registrationId!: string;

  @ManyToOne(() => RegistrationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'registration_id' })
  registration!: RegistrationEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
