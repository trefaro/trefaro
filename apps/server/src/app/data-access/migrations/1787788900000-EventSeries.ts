import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Event series (FR 2.1, FR 2.2) — the first table of the domain itself.
 *
 * The status is a `varchar` with a check constraint rather than a PostgreSQL
 * enum (E6 of the phase 1 plan), so a later value costs one line instead of a
 * type rewrite.
 */
export class EventSeries1787788900000 implements MigrationInterface {
  name = 'EventSeries1787788900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_series" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" character varying(80) NOT NULL,
        "name" character varying(200) NOT NULL,
        "description" text NOT NULL,
        "logo_path" character varying(512),
        "website_url" character varying(512),
        "contact_email" character varying(320),
        "status" character varying(16) NOT NULL DEFAULT 'draft',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_series" PRIMARY KEY ("id"),
        -- The public address of a series; one instance, one meaning per address.
        CONSTRAINT "UQ_event_series_slug" UNIQUE ("slug"),
        CONSTRAINT "CHK_event_series_status" CHECK (
          "status" IN ('draft', 'published', 'archived')
        ),
        -- A series without a name or a description is not something anyone can
        -- publish; FR 2.1 makes both mandatory.
        CONSTRAINT "CHK_event_series_name" CHECK (length(btrim("name")) > 0),
        CONSTRAINT "CHK_event_series_description" CHECK (
          length(btrim("description")) > 0
        )
      )
    `);

    // The participant start page reads exactly this slice.
    await queryRunner.query(`
      CREATE INDEX "IDX_event_series_status_name"
        ON "event_series" ("status", "name")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "event_series"`);
  }
}
