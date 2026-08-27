import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The file upload field type (E9, F12, FR 3.5) — the fourth kind of question.
 *
 * Widens the type check the field kit created in AP 6, which allowed the three
 * types that existed then and said in as many words that `file` would arrive
 * with the storage it needs. It does now, so the constraint follows.
 *
 * The two new columns mirror `options_json`: meaningful for exactly one type,
 * and constrained so that they cannot be set for any other. That is what keeps
 * "a file field accepts at least one type" from being a rule that holds only as
 * long as every code path remembers it.
 *
 * `accept_json` holds MIME types from a fixed catalogue (F38). The catalogue
 * itself is not a check constraint: it is a product decision that changes with
 * what organizations ask for, and a migration is the wrong place to have to
 * change it.
 */
export class FileRegistrationFields1787789500000 implements MigrationInterface {
  name = 'FileRegistrationFields1787789500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "registration_field_def"
        ADD COLUMN "accept_json" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN "max_size_bytes" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "registration_field_def"
        DROP CONSTRAINT "CHK_registration_field_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "registration_field_def"
        ADD CONSTRAINT "CHK_registration_field_type" CHECK (
          "type" IN ('text', 'select', 'checkbox', 'file')
        )
    `);

    await queryRunner.query(`
      ALTER TABLE "registration_field_def"
        ADD CONSTRAINT "CHK_registration_field_accept" CHECK (
          jsonb_typeof("accept_json") = 'array'
          AND ("type" = 'file') = (jsonb_array_length("accept_json") > 0)
        ),
        ADD CONSTRAINT "CHK_registration_field_max_size" CHECK (
          ("type" = 'file') = ("max_size_bytes" IS NOT NULL)
          AND ("max_size_bytes" IS NULL OR "max_size_bytes" > 0)
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Any file field would violate the narrower check, and its answers are
    // already gone with the column that pointed at them — so they go too. The
    // `attachment` rows of a removed field are removed by its own migration's
    // `down`, not here: this one owns the definition, not the files.
    await queryRunner.query(
      `DELETE FROM "registration_field_def" WHERE "type" = 'file'`,
    );

    await queryRunner.query(`
      ALTER TABLE "registration_field_def"
        DROP CONSTRAINT "CHK_registration_field_max_size",
        DROP CONSTRAINT "CHK_registration_field_accept",
        DROP CONSTRAINT "CHK_registration_field_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "registration_field_def"
        ADD CONSTRAINT "CHK_registration_field_type" CHECK (
          "type" IN ('text', 'select', 'checkbox')
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "registration_field_def"
        DROP COLUMN "max_size_bytes",
        DROP COLUMN "accept_json"
    `);
  }
}
