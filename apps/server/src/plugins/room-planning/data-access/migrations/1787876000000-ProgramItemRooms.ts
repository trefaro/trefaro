import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Which room a session happens in (F21) — and the foreign key the phase 0 table
 * could not have.
 *
 * **The join table.** The schema draft gave `program_item` a `room_id`. It does
 * not have one and never will: a plug-in owns its own tables and adds nothing to
 * a core table, so the link lives here, in a table the plug-in creates and drops.
 * The consequence is the good one — an instance with the room plan switched off
 * has a programme that knows nothing about rooms, and switching it on later adds
 * a table instead of migrating a column.
 *
 * Both foreign keys cascade, and the one on `program_item_id` is why this
 * migration is timestamped after the core's `ProgramItems1787789600000`: both
 * streams are ordered together by timestamp, and a reference cannot precede the
 * table it points at.
 *
 * **The overdue key.** `plugin_room_planning_room.event_id` has been a bare uuid
 * since phase 0, because `event` did not exist yet. That gap — a room pointing at
 * an event nobody can find — is the very reason F21 decided against putting a
 * room reference in a core table, so leaving it open here would be inconsistent.
 * It closes now.
 *
 * Rooms whose event never existed are deleted rather than left to break the
 * migration. Deliberate, and narrow: such a row cannot be shown anywhere — the
 * room list is read per event — and the alternative is an instance that will not
 * start. Everything the plug-in owns for events that *do* exist is untouched.
 *
 * `down` removes only what `up` added: the join table goes, the foreign key on
 * `event_id` goes, and the core schema is exactly as it was.
 */
export class ProgramItemRooms1787876000000 implements MigrationInterface {
  name = 'ProgramItemRooms1787876000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Before the constraint, or the constraint is what reports them.
    await queryRunner.query(`
      DELETE FROM "plugin_room_planning_room"
       WHERE NOT EXISTS (
         SELECT 1 FROM "event" WHERE "event"."id" = "plugin_room_planning_room"."event_id"
       )
    `);

    await queryRunner.query(`
      ALTER TABLE "plugin_room_planning_room"
        ADD CONSTRAINT "FK_plugin_room_planning_room_event"
        FOREIGN KEY ("event_id") REFERENCES "event" ("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TABLE "plugin_room_planning_program_item_room" (
        "program_item_id" uuid NOT NULL,
        "room_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        -- The pair is the row: a session may use two rooms and a room hosts many
        -- sessions, but the same pair twice is the same fact twice.
        CONSTRAINT "PK_plugin_room_planning_program_item_room"
          PRIMARY KEY ("program_item_id", "room_id"),
        CONSTRAINT "FK_plugin_room_planning_program_item_room_item"
          FOREIGN KEY ("program_item_id") REFERENCES "program_item" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_plugin_room_planning_program_item_room_room"
          FOREIGN KEY ("room_id") REFERENCES "plugin_room_planning_room" ("id") ON DELETE CASCADE
      )
    `);

    // The primary key already serves "which rooms does this session use"; this is
    // the other direction, which is the one the room plan is read in.
    await queryRunner.query(`
      CREATE INDEX "IDX_plugin_room_planning_program_item_room_room"
        ON "plugin_room_planning_program_item_room" ("room_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE "plugin_room_planning_program_item_room"`,
    );
    await queryRunner.query(`
      ALTER TABLE "plugin_room_planning_room"
        DROP CONSTRAINT "FK_plugin_room_planning_room_event"
    `);
  }
}
