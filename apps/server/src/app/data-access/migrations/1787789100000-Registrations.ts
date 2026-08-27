import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registrations with double opt-in (FR 3.5).
 *
 * What this table decides rather than leaving to the application:
 *
 * - **One address registers once per event** (E10). A unique index over
 *   `(event_id, lower(email))` is the only thing that holds when two copies of
 *   the same form arrive at the same moment; a check-then-insert in the service
 *   would lose that race and produce the duplicate participant the overview must
 *   never show.
 * - **A confirmed registration knows when it was confirmed.** Without the
 *   constraint, a status set by hand in `psql` would leave a confirmed row with
 *   no date, and the double opt-in record — the thing that documents consent —
 *   would be gone.
 * - `confirmed_at` survives a later cancellation on purpose: that somebody once
 *   confirmed is a fact, and cancelling is a new one.
 */
export class Registrations1787789100000 implements MigrationInterface {
  name = 'Registrations1787789100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "registration" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "email" character varying(320) NOT NULL,
        "first_name" character varying(100) NOT NULL,
        "last_name" character varying(100) NOT NULL,
        "phone" character varying(50),
        "origin" character varying(200),
        "custom_fields_json" jsonb NOT NULL DEFAULT '{}',
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "newsletter_opt_in" boolean NOT NULL DEFAULT false,
        "contact_opt_out" boolean NOT NULL DEFAULT false,
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_registration" PRIMARY KEY ("id"),
        -- Deleting an event takes its registrations with it. Whether an event may
        -- be deleted at all is a business rule (E14): a confirmed registration
        -- blocks it, and archiving is the way out.
        CONSTRAINT "FK_registration_event" FOREIGN KEY ("event_id")
          REFERENCES "event" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_registration_status" CHECK (
          "status" IN ('pending', 'confirmed', 'cancelled')
        ),
        CONSTRAINT "CHK_registration_confirmed_at" CHECK (
          "status" <> 'confirmed' OR "confirmed_at" IS NOT NULL
        ),
        CONSTRAINT "CHK_registration_first_name" CHECK (
          length(btrim("first_name")) > 0
        ),
        CONSTRAINT "CHK_registration_last_name" CHECK (
          length(btrim("last_name")) > 0
        ),
        -- Not a full address grammar — that belongs in the validator, which has
        -- one. Here: an address that cannot be one at all never gets stored.
        CONSTRAINT "CHK_registration_email" CHECK (
          "email" = btrim(lower("email")) AND position('@' in "email") > 1
        )
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_registration_event_email"
        ON "registration" ("event_id", lower("email"))
    `);

    // The participant overview (FR 3.3) reads one event's registrations newest
    // first, and the dashboard (FR 3.8) counts them per week over the same rows.
    await queryRunner.query(`
      CREATE INDEX "IDX_registration_event_created_at"
        ON "registration" ("event_id", "created_at" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "registration"`);
  }
}
