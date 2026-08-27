import type { MediaLinkKind } from '@trefaro/shared-models';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventEntity } from './event.entity';
import { ProgramItemEntity } from './program-item.entity';

/**
 * One external stream, recording or material link (FR 3.6, F10).
 *
 * A URL and a title, nothing else: this instance refers to media somebody else
 * hosts, and it never fetches the target — no thumbnail, no oEmbed, no title
 * guessing (F51).
 *
 * `programItemId` is optional. Filled, the link belongs to one session and is
 * rendered with it; empty, it belongs to the event as a whole. Which event the
 * session belongs to is not this entity's word to keep: the migration declares a
 * composite foreign key on `(program_item_id, event_id)`, so a link naming a
 * session of another event cannot be written at all.
 *
 * No `sort` column (F52) — the kind is the order, and within a kind it is the
 * order they were added. The relations are declared for the model's sake; the
 * repository reads by id, exactly as it does everywhere else.
 */
@Entity({ name: 'media_link' })
// Declared here because it is part of the model; the migration owns it as
// `IDX_media_link_event`. This instance never synchronizes a schema.
@Index(['eventId', 'createdAt', 'id'])
export class MediaLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @ManyToOne(() => EventEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: EventEntity;

  /** `null` for a link that belongs to the whole event. */
  @Column({ name: 'program_item_id', type: 'uuid', nullable: true })
  programItemId!: string | null;

  @ManyToOne(() => ProgramItemEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'program_item_id' })
  programItem!: ProgramItemEntity | null;

  /** `stream`, `recording` or `material` — the set lives in `shared-models`. */
  @Column({ type: 'varchar', length: 16 })
  kind!: MediaLinkKind;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 512 })
  url!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
