import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RegistrationEntity } from './registration.entity';

/**
 * One file a participant uploaded with their registration (E9, F12).
 *
 * Two decisions of the schema draft were changed deliberately here (F37):
 *
 * - **The owner is a foreign key, not an `owner_type`/`owner_id` pair.** The
 *   first thing this table has to guarantee is that no file outlives what it
 *   belongs to, and a polymorphic pair cannot be constrained at all. AP 6 of
 *   phase 3 made both `registration_id` and `field_key` nullable **together**
 *   (`CHK_attachment_owner`) rather than adding a second key: a message's
 *   picture is reached from the message, so the arc the database can actually
 *   check is "either a registration asked for this file under a field key, or
 *   neither is set" — plus `CHK_attachment_area`, which keeps the two kinds in
 *   two subtrees of the volume (E19, E40).
 * - **The original file name is kept.** The draft listed path, type and size; an
 *   organizer collecting forty visa documents needs to know which is whose, and
 *   a generated name tells them nothing.
 *
 * There is no `updated_at`: a file is replaced, never edited, so metadata that
 * describes bytes other than its own cannot arise.
 */
@Entity({ name: 'attachment' })
// The migration owns the real thing; this instance never synchronizes a schema.
@Index(['registrationId', 'fieldKey'], { unique: true })
export class AttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** `null` for a message's picture, which no registration asked for (E40). */
  @Column({ name: 'registration_id', type: 'uuid', nullable: true })
  registrationId!: string | null;

  @ManyToOne(() => RegistrationEntity, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'registration_id' })
  registration!: RegistrationEntity | null;

  /**
   * The field that asked for this file.
   *
   * The key rather than the definition's id (F35): the key survives a rewording
   * and outlives the definition itself, and a deleted question does not delete
   * what people answered (F34) — a file least of all.
   *
   * `null` exactly when {@link registrationId} is, and enforced as a pair: a
   * message's picture answers no question, and a file with a field key but no
   * registration would be an answer to nobody.
   */
  @Column({ name: 'field_key', type: 'varchar', length: 80, nullable: true })
  fieldKey!: string | null;

  /** Relative to the upload volume, so the volume can be mounted anywhere. */
  @Column({ name: 'file_path', type: 'varchar', length: 512 })
  path!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 200 })
  fileName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
