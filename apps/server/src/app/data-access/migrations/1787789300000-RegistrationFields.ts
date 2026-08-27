import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The field kit of the registration form (F12, FR 3.5).
 *
 * What this table decides rather than leaving to the application:
 *
 * - **A key is unique per event.** The key is what an answer is stored under in
 *   `registration.custom_fields_json`; two fields sharing one would make an
 *   answer ambiguous, and only a unique index settles that between two
 *   simultaneous requests.
 * - **A key looks like a key.** The same grammar as a slug — lower case, digits
 *   and single hyphens — because it appears in JSON, in a form control name and
 *   later in an export header. The service derives it from the label with the
 *   same function that derives an event's public address from its name.
 * - **A select field has choices.** A select without options renders as an empty
 *   dropdown, which is a field nobody can fill in; the constraint makes that
 *   state unreachable rather than merely unlikely.
 * - **Only the three types of AP 6 exist.** `file` (FR 3.5's visa documents)
 *   needs the storage of AP 7, and an enum value whose form control does not
 *   exist yet would be a trap. The check constraint is widened when the type
 *   arrives.
 *
 * `sort` is deliberately *not* unique per event: the order is renumbered as a
 * whole in one transaction, and a unique constraint would force a temporary
 * shuffle to keep from colliding with itself mid-update.
 */
export class RegistrationFields1787789300000 implements MigrationInterface {
  name = 'RegistrationFields1787789300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "registration_field_def" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "key" character varying(80) NOT NULL,
        "label" character varying(200) NOT NULL,
        "type" character varying(16) NOT NULL,
        "help_text" character varying(500),
        "options_json" jsonb NOT NULL DEFAULT '[]',
        "required" boolean NOT NULL DEFAULT false,
        "sort" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_registration_field_def" PRIMARY KEY ("id"),
        -- Deleting an event takes its form definition with it, exactly as it
        -- takes the registrations. Whether an event may be deleted at all is a
        -- business rule (E14).
        CONSTRAINT "FK_registration_field_event" FOREIGN KEY ("event_id")
          REFERENCES "event" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_registration_field_type" CHECK (
          "type" IN ('text', 'select', 'checkbox')
        ),
        CONSTRAINT "CHK_registration_field_key" CHECK (
          "key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        ),
        CONSTRAINT "CHK_registration_field_label" CHECK (
          length(btrim("label")) > 0
        ),
        CONSTRAINT "CHK_registration_field_options" CHECK (
          jsonb_typeof("options_json") = 'array'
          AND ("type" = 'select') = (jsonb_array_length("options_json") > 0)
        ),
        CONSTRAINT "CHK_registration_field_sort" CHECK ("sort" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_registration_field_event_key"
        ON "registration_field_def" ("event_id", "key")
    `);

    // Every read of this table is "the form of one event, in order" — the public
    // registration page on every visit, and the validation on every submission.
    await queryRunner.query(`
      CREATE INDEX "IDX_registration_field_event_sort"
        ON "registration_field_def" ("event_id", "sort", "id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "registration_field_def"`);
  }
}
