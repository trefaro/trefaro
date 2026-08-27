import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Events within a series (FR 3.1, FR 3.2, FR 3.9).
 *
 * Three things this table decides rather than leaves to the application:
 *
 * - The slug is unique **per series**, not per instance (E7), so two series may
 *   each hold a `kickoff` without one of them getting a numbered address.
 * - `ends_at` may not precede `starts_at`. A negative period would show up as a
 *   nonsense line on the landing page long before anyone noticed the cause.
 * - A **published** event has to be reachable: an online one needs a link, an
 *   on-site one an address, a hybrid one both. A draft may be incomplete on
 *   purpose — an organizer plans the date before the conference software is
 *   booked, and demanding the link up front would make them invent one.
 */
export class Events1787789000000 implements MigrationInterface {
  name = 'Events1787789000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "series_id" uuid NOT NULL,
        "slug" character varying(80) NOT NULL,
        "name" character varying(200) NOT NULL,
        "description" text NOT NULL,
        "logo_path" character varying(512),
        "event_type" character varying(16) NOT NULL,
        "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "timezone" character varying(64) NOT NULL,
        "venue_name" character varying(200),
        "venue_address" text,
        "online_url" character varying(512),
        "languages" character varying(16)[] NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'draft',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_event_slug_in_series" UNIQUE ("series_id", "slug"),
        -- Deleting a series takes its events with it. Whether a series may be
        -- deleted at all is a business rule (E14): from AP 4 a confirmed
        -- registration blocks it, and archiving is the way out.
        CONSTRAINT "FK_event_series" FOREIGN KEY ("series_id")
          REFERENCES "event_series" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_event_type" CHECK (
          "event_type" IN ('onsite', 'online', 'hybrid')
        ),
        CONSTRAINT "CHK_event_status" CHECK (
          "status" IN ('draft', 'published', 'archived')
        ),
        CONSTRAINT "CHK_event_period" CHECK ("ends_at" >= "starts_at"),
        CONSTRAINT "CHK_event_name" CHECK (length(btrim("name")) > 0),
        CONSTRAINT "CHK_event_description" CHECK (
          length(btrim("description")) > 0
        ),
        -- FR 3.1 lists the languages an event is held in; an empty list says
        -- nothing and would render as an empty label.
        CONSTRAINT "CHK_event_languages" CHECK (
          cardinality("languages") > 0
        ),
        CONSTRAINT "CHK_event_published_place" CHECK (
          "status" <> 'published'
          OR ("event_type" = 'online' AND "online_url" IS NOT NULL)
          OR ("event_type" = 'onsite' AND "venue_name" IS NOT NULL)
          OR (
            "event_type" = 'hybrid'
            AND "venue_name" IS NOT NULL
            AND "online_url" IS NOT NULL
          )
        )
      )
    `);

    // Both the organizer's series page and the participant's read the events of
    // one series in date order (FR 2.3).
    await queryRunner.query(`
      CREATE INDEX "IDX_event_series_starts_at"
        ON "event" ("series_id", "starts_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "event"`);
  }
}
