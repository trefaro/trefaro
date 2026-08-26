import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Room planning plug-in schema.
 *
 * Shipped by the plug-in, not by the core: it creates only tables the plug-in
 * owns, prefixed `plugin_room_planning_` so ownership is obvious in psql, and it
 * alters no core table.
 *
 * The table stays in place when the plug-in is switched off — disabling a
 * plug-in hides its functionality, it does not throw away the organization's
 * data. Only `down` removes it.
 */
export class CreateRoomPlanningSchema1787702500000 implements MigrationInterface {
  name = 'CreateRoomPlanningSchema1787702500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "plugin_room_planning_room" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "name" character varying(128) NOT NULL,
        "capacity" integer NOT NULL,
        "floor" character varying(64),
        "description" text,
        CONSTRAINT "PK_plugin_room_planning_room" PRIMARY KEY ("id"),
        -- A room with no seats cannot be overbooked, nor used.
        CONSTRAINT "CHK_plugin_room_planning_room_capacity" CHECK ("capacity" >= 1),
        CONSTRAINT "UQ_plugin_room_planning_room_name" UNIQUE ("event_id", "name")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_plugin_room_planning_room_event"
        ON "plugin_room_planning_room" ("event_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "plugin_room_planning_room"`);
  }
}
