import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The profile itself: picture, field of activity, visibility, and the field kit
 * behind the rest of it (FR 4.3 — E35, E36, E37).
 *
 * `UserAccounts` deliberately left these columns out — "a column nothing reads
 * yet looks like a feature that exists" (F42) — and this is the work package
 * that reads and writes them. Four decisions are carried by this file:
 *
 * 1. **The picture is a path into its own subtree, and the database says so**
 *    (F124, F113 applied to a person). `CHK_user_profile_avatar_path` allows
 *    `NULL` or `avatars/%` and nothing else, the third layer under the route
 *    that takes no path and the service that checks the area. The neighbours of
 *    a stored path are registration attachments, which may be passport scans
 *    (E9), and an avatar route must not be able to name one.
 * 2. **The field of activity is a column, not a question in the kit** (E36). FR
 *    4.4 filters the participant search on it, and a criterion that lives inside
 *    `custom_fields_json` cannot be compared or indexed reliably.
 * 3. **`searchable` starts off** and is the opt-in for being found **and** for
 *    being contacted (E37, F13). Its default is the whole point: an activist
 *    profile that becomes findable because somebody shipped a migration is
 *    exactly the accident this project cannot afford.
 * 4. **The field kit is instance-wide** (E35). `profile_field` has no
 *    `event_id`: a profile belongs to a person and not to an event, and a
 *    question that has to differ per event belongs in the registration form,
 *    which has had one since phase 1. The key is unique across the instance for
 *    that reason, and `sort` is deliberately not unique — the order is rewritten
 *    as a whole, in one transaction, so a unique constraint would only force a
 *    temporary shuffle to avoid colliding with itself.
 *
 * The shape follows `registration_field_def` down to the column names, because
 * the two kits share their rules (`business/common/field-kit.ts`) and one form
 * component has to render both. What it does not share is a `file` type: a file
 * is not an answer in the JSON (F37) but an `attachment` row, and a profile has
 * no registration for one to hang off.
 */
export class ProfileFields1787790600000 implements MigrationInterface {
  name = 'ProfileFields1787790600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_profile"
        ADD "avatar_path" character varying(512),
        ADD "activity_areas" character varying(200),
        -- Never NULL: "no answers" is an empty object, so nothing has to tell
        -- an unanswered form from an unwritten column.
        ADD "custom_fields_json" jsonb NOT NULL DEFAULT '{}',
        -- Off. Being findable is a decision its owner makes (E37).
        ADD "searchable" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "user_profile"
        ADD CONSTRAINT "CHK_user_profile_avatar_path" CHECK (
          "avatar_path" IS NULL OR "avatar_path" LIKE 'avatars/%'
        )
    `);

    await queryRunner.query(`
      CREATE TABLE "profile_field" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        -- Derived from the label, then immutable (F35): renaming a question
        -- must not orphan the answers already given.
        "key" character varying(80) NOT NULL,
        "label" character varying(200) NOT NULL,
        -- text | select | checkbox. No file (F37), and no numeric type.
        "type" character varying(16) NOT NULL,
        "help_text" character varying(500),
        "options_json" jsonb NOT NULL DEFAULT '[]',
        "required" boolean NOT NULL DEFAULT false,
        "sort" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_profile_field" PRIMARY KEY ("id"),
        -- Instance-wide, unlike the registration kit's per-event key: there is
        -- one profile form (E35), and the index is what decides a race between
        -- two organizers defining the same question at the same moment.
        CONSTRAINT "UQ_profile_field_key" UNIQUE ("key")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "profile_field"`);
    // The answers go with the columns, and that is the one thing about this
    // `down` worth saying out loud: F34 keeps the answers of a deleted
    // *question*, because the question is not the answer — but rolling the
    // schema back is not the same act, and there is nowhere left to keep them.
    await queryRunner.query(`
      ALTER TABLE "user_profile"
        DROP CONSTRAINT "CHK_user_profile_avatar_path"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_profile"
        DROP COLUMN "searchable",
        DROP COLUMN "custom_fields_json",
        DROP COLUMN "activity_areas",
        DROP COLUMN "avatar_path"
    `);
  }
}
