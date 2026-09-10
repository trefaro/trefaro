import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The personal programme plug-in's own table (FR 3.17).
 *
 * The one migration of AP 9 of phase 4, and the fifth plug-in schema in this
 * repository. Explicit SQL, `down` written out, and `plugin_<key>_<name>` as
 * the name — a reader of `\dt` can tell at a glance which tables belong to a
 * plug-in and would go away with it.
 *
 * Stamped after the core migrations it points at — `program_item` (phase 1) and
 * `user_profile` (phase 3) — and after the check-in's, because both migration
 * streams are ordered together by timestamp and a reference cannot precede the
 * table it points at.
 *
 * The whole schema is one composite key and two foreign keys, and the shape is
 * the point:
 *
 * - **`(user_id, program_item_id)` is the primary key** (E55). A selection
 *   exists or it does not, so putting the same session in twice is the same
 *   row, and the database says so rather than the service checking first.
 * - **No capacity, no seat, no status.** This is the table that makes the
 *   difference between a plan and a sign-up readable in `\d`: everything
 *   `program_item_signup` needs to hold a place is missing here, on purpose.
 * - **Both keys cascade.** A deleted session leaves nobody's plan behind, and a
 *   deleted account takes its plan with it.
 *
 * One index beyond the primary key: `(program_item_id)`. The primary key serves
 * every read this plug-in makes — a person's selection within one event — and
 * the second index is what makes the cascade of a deleted session a lookup
 * rather than a scan of everybody's plans.
 */
export class CreatePersonalProgramSchema1787910000000 implements MigrationInterface {
  name = 'CreatePersonalProgramSchema1787910000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "plugin_personal_program_entry" (
        "user_id" uuid NOT NULL,
        "program_item_id" uuid NOT NULL,
        "added_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        -- The pair is the row: a session is in a plan or it is not, and there
        -- is no second state to tell two rows apart (E55).
        CONSTRAINT "PK_plugin_personal_program_entry"
          PRIMARY KEY ("user_id", "program_item_id"),
        -- A deleted account takes its plan with it, which is what makes
        -- erasure one statement.
        CONSTRAINT "FK_plugin_personal_program_entry_user"
          FOREIGN KEY ("user_id") REFERENCES "user_profile" ("id")
          ON DELETE CASCADE,
        -- A deleted session leaves nobody's plan behind. A plug-in's own table
        -- may say so towards a core table: it binds the plug-in (F21).
        CONSTRAINT "FK_plugin_personal_program_entry_item"
          FOREIGN KEY ("program_item_id") REFERENCES "program_item" ("id")
          ON DELETE CASCADE
      )
    `);
    // The other direction of the pair: what the cascade of a deleted session
    // needs, and the only read that does not start from a person.
    await queryRunner.query(`
      CREATE INDEX "IDX_plugin_personal_program_entry_item"
        ON "plugin_personal_program_entry" ("program_item_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Nothing outside the plug-in was touched, so there is nothing else to undo.
    await queryRunner.query(
      `DROP INDEX "IDX_plugin_personal_program_entry_item"`,
    );
    await queryRunner.query(`DROP TABLE "plugin_personal_program_entry"`);
  }
}
