import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The instance's own changes to the shipped catalogue, and the languages a fresh
 * instance offers (AP 6 of phase 2 — E22, E23).
 *
 * Chapter 4 asks that new languages be maintainable *by the organization*. That
 * rules out compile-time i18n, and it rules out JSON inside a client image just
 * as much — both are changed by rebuilding, which is exactly what an
 * organization running a container cannot do. So the catalogue an instance
 * serves is the shipped one overlaid with these rows, and this table is the
 * whole of "maintainable".
 *
 * One row per key per language, and deliberately nothing else:
 *
 * - **No foreign key to the active locales.** A language is created by
 *   translating it — AP 7's language administration writes rows for `fr` before
 *   anything says `fr` exists — and removing it from `app_config.active_locales`
 *   must not delete the work. The two facts are independent: what is *offered*
 *   is configuration, what is *translated* is content.
 * - **No `key` catalogue table.** English is the key list (E23), and English
 *   ships with the image. A row whose key the shipped catalogue no longer has is
 *   ignored on read, not an integrity error — the alternative would make every
 *   renamed key a migration over an organization's data.
 * - **No `source` or `author` column.** Every row here has exactly one origin:
 *   an administrator typed it. `updated_at` is what a reviewer needs.
 *
 * `value` is `text` rather than a bounded string because from AP 10 the four
 * mail bodies live in this catalogue; the request that writes one is bounded by
 * `MAX_TRANSLATION_VALUE_LENGTH` in the business layer, where a limit can carry
 * a message.
 */
export class Translations1787790200000 implements MigrationInterface {
  name = 'Translations1787790200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "translation_override" (
        "locale" character varying(16) NOT NULL,
        "key" character varying(200) NOT NULL,
        "value" text NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_translation_override" PRIMARY KEY ("locale", "key")
      )
    `);

    // Every read is "the whole catalogue of one language", so the primary key's
    // leading column already serves it. Spelled out anyway because the primary
    // key is the only index here and a later `PK` change must not silently take
    // the only access path with it.
    await queryRunner.query(`
      CREATE INDEX "IDX_translation_override_locale"
        ON "translation_override" ("locale")
    `);

    // An instance offers the languages this image ships.
    //
    // Until now `active_locales` was seeded with English alone, so an instance
    // carrying a complete German catalogue did not offer German: the switcher
    // had nothing to switch, and NFR 4's "English plus the national language"
    // held only for whoever ran the setup wizard and chose German. A finished
    // translation that ships inside the image and is hidden by a default is a
    // defect, not a configuration.
    //
    // Only where the value is still *exactly* the seeded default, because this
    // may not overwrite a decision. An organization that deliberately offers
    // English alone is indistinguishable from one that never chose — the setup
    // wizard writes the same array, since it asks which language the instance
    // runs in and not which ones it offers — and both get German back here.
    // That is the right way round: AP 7's language administration can remove a
    // language, and removing one keeps the translation (there is deliberately
    // no foreign key from `translation_override`). The other direction, an
    // organization that cannot find the German it was shipped, has no screen to
    // fix it on.
    //
    // The literal `de` is a historical fact rather than a list to maintain: at
    // this version the image ships `en` and `de`. A later image that ships a
    // third language offers it through the language administration, not here.
    await queryRunner.query(`
      UPDATE "app_config"
        SET "active_locales" = ARRAY['en', 'de']
        WHERE "active_locales" = ARRAY['en']::character varying(16)[]
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // The offer goes back to English alone only where this migration is what
    // widened it; a language somebody added stays.
    await queryRunner.query(`
      UPDATE "app_config"
        SET "active_locales" = ARRAY['en']
        WHERE "active_locales" = ARRAY['en', 'de']::character varying(16)[]
    `);
    await queryRunner.query(`DROP INDEX "IDX_translation_override_locale"`);
    await queryRunner.query(`DROP TABLE "translation_override"`);
  }
}
