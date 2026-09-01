import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The guarantee that a series or event logo is a logo (FR 2.1, FR 3.1 — E19).
 *
 * No columns: `event_series.logo_path` and `event.logo_path` have existed since
 * phase 1, they were simply never written — the upload arrives with this work
 * package. What is missing is the constraint, and it is the same argument as
 * `CHK_app_config_branding_paths`.
 *
 * E9 says the upload volume is never served statically and an attachment is only
 * ever reachable through an authenticated download; FR 2.1 and FR 3.1 want a
 * logo on a page anyone may read. Both hold at once only if the two kinds of
 * file cannot be mistaken for one another, so a row logo lives in its own
 * subtree of the volume and these constraints are what make "the public route
 * serves exactly what the row points at" safe: whatever writes these columns,
 * they cannot come to hold the path of a passport scan. The route takes no path
 * from its caller, the service checks the subtree, and the database refuses the
 * rest — three layers for one property, because this is the second public route
 * to stored bytes in the whole application.
 *
 * NULL stays the normal state. Neither requirement means "you may not publish
 * without a picture", and an instance whose organization logo already sits in
 * the header does not need it repeated on every series.
 */
export class EntityLogos1787790400000 implements MigrationInterface {
  name = 'EntityLogos1787790400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Anything already in these columns would have been written before the
    // upload existed, so there is nothing to migrate — but a constraint that
    // cannot be added is a migration that fails halfway, and phase 1 shipped a
    // placeholder shape. Clearing first makes this repeatable on any instance.
    await queryRunner.query(`
      UPDATE "event_series" SET "logo_path" = NULL
        WHERE "logo_path" IS NOT NULL AND "logo_path" NOT LIKE 'logos/%'
    `);
    await queryRunner.query(`
      UPDATE "event" SET "logo_path" = NULL
        WHERE "logo_path" IS NOT NULL AND "logo_path" NOT LIKE 'logos/%'
    `);

    await queryRunner.query(`
      ALTER TABLE "event_series"
        ADD CONSTRAINT "CHK_event_series_logo_path" CHECK (
          "logo_path" IS NULL OR "logo_path" LIKE 'logos/%'
        )
    `);
    await queryRunner.query(`
      ALTER TABLE "event"
        ADD CONSTRAINT "CHK_event_logo_path" CHECK (
          "logo_path" IS NULL OR "logo_path" LIKE 'logos/%'
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event" DROP CONSTRAINT "CHK_event_logo_path"
    `);
    await queryRunner.query(`
      ALTER TABLE "event_series" DROP CONSTRAINT "CHK_event_series_logo_path"
    `);
  }
}
