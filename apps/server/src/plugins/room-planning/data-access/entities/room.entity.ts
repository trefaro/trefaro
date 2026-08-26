import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A room of an event's venue (FR 3.11).
 *
 * Owned entirely by the room planning plug-in: the table is created and dropped
 * by the plug-in's own migration, and no core migration knows it exists.
 *
 * `event_id` deliberately carries no foreign key. The core `event` table arrives
 * in phase 1, and a plug-in must not add constraints to core tables — so the
 * reference is validated by the plug-in instead of by the database. The reverse
 * link (which room a programme item uses) is an open design question recorded in
 * the phase 0 spike protocol.
 */
@Entity({ name: 'plugin_room_planning_room' })
@Index(['eventId'])
export class RoomEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'integer' })
  capacity!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  floor!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
