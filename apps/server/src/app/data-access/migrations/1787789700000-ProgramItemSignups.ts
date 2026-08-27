import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-item sign-up (FR 3.10) — AP 9.
 *
 * Two columns and one table, and each of the three carries a rule:
 *
 * - **`registration_enabled`** — most sessions are simply attended. Only some
 *   ask who is coming, so the flag is off by default and the whole feature is
 *   invisible until an organizer turns it on for one session.
 * - **`capacity`** — nullable, because "as many as come" is the normal case, and
 *   `CHECK` bound to the flag: a limit that nothing enforces looks exactly like
 *   one that is enforced, which is the worse of the two failures. AP 8
 *   deliberately left both columns out until this table gave them a meaning.
 * - **`program_item_signup`** — one row per person per session, unique on the
 *   pair. The unique index is what decides a double click, exactly as it decides
 *   a repeated registration (E10); the application does not race itself.
 *
 * Both foreign keys cascade, and that is the point of the pair: deleting a
 * session takes its sign-ups, and deleting a registration takes the seats that
 * person had claimed. Nothing has to remember to clean up after either — which
 * matters for the erasure functions of phase 5, where a forgotten row is a
 * person who was not forgotten.
 *
 * What is *not* here: a check that the capacity is at least as large as the
 * number of sign-ups. An organizer who moves a workshop into a smaller room is
 * over-subscribed, and the answer to that is showing them, not refusing the
 * change and leaving them stuck.
 */
export class ProgramItemSignups1787789700000 implements MigrationInterface {
  name = 'ProgramItemSignups1787789700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "program_item"
        ADD COLUMN "registration_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN "capacity" integer,
        ADD CONSTRAINT "CHK_program_item_capacity" CHECK (
          "capacity" IS NULL OR "capacity" >= 1
        ),
        ADD CONSTRAINT "CHK_program_item_capacity_needs_signup" CHECK (
          "registration_enabled" OR "capacity" IS NULL
        )
    `);

    await queryRunner.query(`
      CREATE TABLE "program_item_signup" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "program_item_id" uuid NOT NULL,
        "registration_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_program_item_signup" PRIMARY KEY ("id"),
        CONSTRAINT "FK_program_item_signup_item" FOREIGN KEY ("program_item_id")
          REFERENCES "program_item" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_program_item_signup_registration" FOREIGN KEY ("registration_id")
          REFERENCES "registration" ("id") ON DELETE CASCADE,
        -- One seat per person per session. A second click is not a second seat.
        CONSTRAINT "UQ_program_item_signup" UNIQUE ("program_item_id", "registration_id")
      )
    `);

    // "What has this person signed up for" is the read the self-service page
    // makes on every visit; the unique index above already serves the counts per
    // session, so this is the one index that is not free.
    await queryRunner.query(`
      CREATE INDEX "IDX_program_item_signup_registration"
        ON "program_item_signup" ("registration_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "program_item_signup"`);
    await queryRunner.query(`
      ALTER TABLE "program_item"
        DROP CONSTRAINT "CHK_program_item_capacity_needs_signup",
        DROP CONSTRAINT "CHK_program_item_capacity",
        DROP COLUMN "capacity",
        DROP COLUMN "registration_enabled"
    `);
  }
}
