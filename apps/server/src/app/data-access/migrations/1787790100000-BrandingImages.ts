import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The app icon column, and the guarantee that branding files are branding files
 * (AP 2 of phase 2 — E19, E26).
 *
 * Two changes, one idea. The column is the smaller half: a PWA whose home screen
 * icon says "Trefaro" is not a whitelabel application, and a logo in letterhead
 * format gets cropped to a square by the operating system, so the icon is a
 * second, optional upload rather than the same file used twice.
 *
 * The check constraint is the half that matters. E9 says the upload volume is
 * never served statically and an attachment is only ever reachable through an
 * authenticated download; E19 says a logo must be visible without a login. Both
 * hold at the same time only if the two kinds of file cannot be mistaken for one
 * another — so branding files live in their own subtree of the volume, and this
 * constraint is what makes "the public route serves exactly what `app_config`
 * points at" safe: whatever writes these columns, they cannot come to hold the
 * path of a passport scan. The route takes no path from its caller, the service
 * checks the subtree, and the database refuses the rest. Same line as F54: the
 * belonging is guaranteed where it cannot be argued with.
 */
export class BrandingImages1787790100000 implements MigrationInterface {
  name = 'BrandingImages1787790100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "app_config"
        ADD COLUMN "app_icon_path" character varying(512)
    `);

    // NULL is the normal state — neither image is required, and a fresh instance
    // shows its name and the shipped icons until somebody uploads something.
    await queryRunner.query(`
      ALTER TABLE "app_config"
        ADD CONSTRAINT "CHK_app_config_branding_paths" CHECK (
          ("logo_path" IS NULL OR "logo_path" LIKE 'branding/%')
          AND ("app_icon_path" IS NULL OR "app_icon_path" LIKE 'branding/%')
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "app_config" DROP CONSTRAINT "CHK_app_config_branding_paths"
    `);
    await queryRunner.query(`
      ALTER TABLE "app_config" DROP COLUMN "app_icon_path"
    `);
  }
}
