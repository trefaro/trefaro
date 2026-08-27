import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * The room a session happens in (F21).
 *
 * The table the schema draft's `program_item.room_id` became. It belongs to the
 * plug-in: created and dropped by the plug-in's own migration, listed in the
 * plug-in's own persistence contribution, and unknown to every core entity.
 *
 * No `ManyToOne` towards `ProgramItemEntity`. The relation exists in the database
 * — the migration declares both foreign keys — but declaring it here would mean
 * importing a core entity into a plug-in, which is the coupling F21 was decided
 * to avoid. The plug-in reads sessions through the versioned port instead (E12).
 */
@Entity({ name: 'plugin_room_planning_program_item_room' })
@Index(['roomId'])
export class ProgramItemRoomEntity {
  @PrimaryColumn({ name: 'program_item_id', type: 'uuid' })
  programItemId!: string;

  @PrimaryColumn({ name: 'room_id', type: 'uuid' })
  roomId!: string;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt!: Date;
}
