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
 *   belongs to, and a polymorphic pair cannot be constrained at all. Phase 3,
 *   which adds attachments to chat messages, adds a second nullable key and a
 *   check that exactly one is set — an honest exclusive arc rather than two
 *   columns the database cannot check.
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

  @Column({ name: 'registration_id', type: 'uuid' })
  registrationId!: string;

  @ManyToOne(() => RegistrationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'registration_id' })
  registration!: RegistrationEntity;

  /**
   * The field that asked for this file.
   *
   * The key rather than the definition's id (F35): the key survives a rewording
   * and outlives the definition itself, and a deleted question does not delete
   * what people answered (F34) — a file least of all.
   */
  @Column({ name: 'field_key', type: 'varchar', length: 80 })
  fieldKey!: string;

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
