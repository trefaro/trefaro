import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The instance's own name, and the font as a catalogue key (FR 1.4) — phase 2,
 * AP 1.
 *
 * Two changes to `app_config`, both prerequisites for the first endpoint that
 * writes it:
 *
 * 1. **`organization_name`** — until now the instance was called Trefaro
 *    everywhere, which is the name of the software, not of the organization
 *    running it. Page titles, mails and (in AP 12) the PWA manifest need the
 *    latter. `NOT NULL DEFAULT 'Trefaro'` so the existing row gets a value
 *    without a second statement, and so a fresh install has something to show
 *    before anybody has visited the design page.
 * 2. **`font_family` now holds a key of `FONT_FAMILIES`, not a CSS stack.**
 *    The stack is derived in the business layer (`fontFamilyStack`). Storing the
 *    key is what lets a stack be corrected — a fallback added, a family renamed
 *    upstream — without a data migration, and it is where a per-instance
 *    uploaded font would attach later (E18): the key names the family, a second
 *    column would say where its file is.
 *
 * The conversion is a blanket `UPDATE`, not a mapping table, because there is
 * nothing to map: phase 1 shipped no write path for this column, so its value is
 * the seeded `'system-ui, sans-serif'` on every instance that exists. Anything
 * else is a hand-edited row, and the safe reading of a hand-edited font is the
 * default one — visible on the design page and correctable in a click.
 *
 * No `CHECK` on `font_family`, deliberately, and the same reasoning as `kind` in
 * `media_link` (F52) and `event_type` before it: the catalogue is a product
 * decision that lives in `shared-models` and is enforced by the DTO and the
 * service. A constraint here would be a second list to keep in step, and it
 * would turn adding a font into a migration.
 */
export class InstanceIdentity1787790000000 implements MigrationInterface {
  name = 'InstanceIdentity1787790000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "app_config"
        ADD COLUMN "organization_name" character varying(128)
          NOT NULL DEFAULT 'Trefaro'
    `);

    await queryRunner.query(`
      UPDATE "app_config"
         SET "font_family" = 'system-ui'
       WHERE "font_family" NOT IN (
         'system-ui', 'inter', 'source-sans-3',
         'atkinson-hyperlegible-next', 'lora'
       )
    `);

    // 256 was room for a font stack. A key is at most a few dozen characters,
    // and the narrower column says what the column is for.
    await queryRunner.query(`
      ALTER TABLE "app_config"
        ALTER COLUMN "font_family" TYPE character varying(64)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Widen before writing stacks back, or the longest of them will not fit.
    await queryRunner.query(`
      ALTER TABLE "app_config"
        ALTER COLUMN "font_family" TYPE character varying(256)
    `);

    await queryRunner.query(`
      UPDATE "app_config"
         SET "font_family" = CASE "font_family"
           WHEN 'inter' THEN '''Inter'', system-ui, sans-serif'
           WHEN 'source-sans-3' THEN '''Source Sans 3'', system-ui, sans-serif'
           WHEN 'atkinson-hyperlegible-next'
             THEN '''Atkinson Hyperlegible Next'', system-ui, sans-serif'
           WHEN 'lora' THEN '''Lora'', Georgia, serif'
           ELSE 'system-ui, sans-serif'
         END
    `);

    await queryRunner.query(`
      ALTER TABLE "app_config" DROP COLUMN "organization_name"
    `);
  }
}
