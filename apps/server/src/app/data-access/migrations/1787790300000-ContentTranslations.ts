import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Translations of what an organization writes: series, events, sessions
 * (AP 11 of phase 2 — FR 3.12, E25).
 *
 * Three tables rather than one, and no polymorphic `(entity_type, entity_id)`
 * column: a foreign key that cannot name its target is not a foreign key, and
 * `ON DELETE CASCADE` is the entire reason these tables can be forgotten about.
 * Deleting an event has to take its translations with it — nobody will remember
 * to, and a row pointing at an event that is gone would surface as a translation
 * appearing under a *new* event that happened to be given the same id. Three
 * tables get that from the database for nothing.
 *
 * The shape each one shares:
 *
 * - **Composite key `(<parent>_id, locale)`.** A translation is identified by
 *   what it translates and which language it is in; a surrogate id would be a
 *   second thing to keep unique and would let two rows claim one language.
 * - **Every text column nullable.** Translation is field by field (E25): `NULL`
 *   means "use the original", not "empty". An organizer translates the title
 *   today and the description next week, and no page shows a hole in between.
 * - **No foreign key to the offered languages.** As with `translation_override`:
 *   a language exists because somebody translated something into it, and taking
 *   it out of `app_config.active_locales` must not delete the work.
 * - **No `CHECK (length(btrim(...)) > 0)` like the originals carry.** The
 *   original's name is mandatory and therefore non-empty; a *translation* of it
 *   is optional, and the business layer stores a cleared box as `NULL` rather
 *   than as `''` (F74's rule, applied to content). The column may be absent, it
 *   may not be blank.
 *
 * Which columns are missing is the other half of the decision. `venue_address`
 * and `speaker` have no translation: a street is the same street in every
 * language and a translated one sends people to the wrong place, and a person's
 * name is what they are called. `event.languages` has none either — the
 * languages an event is *held* in (FR 3.1) is a fact about the event, not a
 * rendering of it, which is why an English-language conference may have a German
 * landing page.
 */
export class ContentTranslations1787790300000 implements MigrationInterface {
  name = 'ContentTranslations1787790300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_series_translation" (
        "series_id" uuid NOT NULL,
        "locale" character varying(16) NOT NULL,
        "name" character varying(200),
        "description" text,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_series_translation"
          PRIMARY KEY ("series_id", "locale"),
        CONSTRAINT "FK_event_series_translation_series"
          FOREIGN KEY ("series_id") REFERENCES "event_series" ("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "event_translation" (
        "event_id" uuid NOT NULL,
        "locale" character varying(16) NOT NULL,
        "name" character varying(200),
        "description" text,
        "venue_name" character varying(200),
        "follow_up_body" text,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_translation" PRIMARY KEY ("event_id", "locale"),
        CONSTRAINT "FK_event_translation_event"
          FOREIGN KEY ("event_id") REFERENCES "event" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "program_item_translation" (
        "program_item_id" uuid NOT NULL,
        "locale" character varying(16) NOT NULL,
        "title" character varying(200),
        "description" character varying(2000),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_program_item_translation"
          PRIMARY KEY ("program_item_id", "locale"),
        CONSTRAINT "FK_program_item_translation_item"
          FOREIGN KEY ("program_item_id") REFERENCES "program_item" ("id")
          ON DELETE CASCADE
      )
    `);

    // Two access paths, and the primary key only serves one of them.
    //
    // Reading a landing page asks "this parent, this language" — the primary
    // key's leading column answers that. The organizer's translation screen asks
    // "every language of this parent", which it also answers. What neither
    // answers is the participant list page: "these thirty series, in German" is
    // a lookup by *language* across parents, and without this index it is a
    // sequential scan of every translation an instance owns.
    await queryRunner.query(`
      CREATE INDEX "IDX_event_series_translation_locale"
        ON "event_series_translation" ("locale")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_event_translation_locale"
        ON "event_translation" ("locale")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_program_item_translation_locale"
        ON "program_item_translation" ("locale")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping the tables drops their indexes and keys with them; the parents
    // are untouched, because nothing outside these three tables was added.
    await queryRunner.query(`DROP TABLE "program_item_translation"`);
    await queryRunner.query(`DROP TABLE "event_translation"`);
    await queryRunner.query(`DROP TABLE "event_series_translation"`);
  }
}
