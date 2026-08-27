import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The programme of an event (FR 3.7) — AP 8.
 *
 * What this table decides rather than leaving to the application:
 *
 * - **A session has a length.** `ends_at > starts_at`, strictly. An item of no
 *   duration cannot be drawn on a timeline and cannot be attended; an event may
 *   still be booked as a single instant while the details are open, which is why
 *   the two constraints differ.
 * - **A session has a title.** It is the one thing a participant reads in a
 *   timeline row, and an untitled row is an empty line.
 * - **A session belongs to exactly one event**, and goes with it: `ON DELETE
 *   CASCADE`, exactly as the registration form and the registrations do. Whether
 *   an event may be deleted at all is a business rule (E14).
 *
 * What it deliberately does *not* decide:
 *
 * - **That the item lies inside the event's period.** A `CHECK` cannot read
 *   another table, and a trigger would put a product rule where nobody looks for
 *   it. The service enforces it, and only when a period is being written — an
 *   organizer who shifts an event leaves its programme behind outside the new
 *   period, and those items have to stay editable so they can be moved back in
 *   (F41).
 * - **That two items do not overlap.** Parallel sessions are what a two-track
 *   conference is (F41). The organizer's view marks them; nothing refuses them.
 *
 * Two columns of the schema draft are absent on purpose: `room_id`, which is the
 * room planning plug-in's own join table (F21), and `sort`, because a programme
 * is ordered by the clock (F40). `registration_enabled` and `capacity` arrive in
 * AP 9 with the sign-up table that gives them a meaning.
 */
export class ProgramItems1787789600000 implements MigrationInterface {
  name = 'ProgramItems1787789600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "program_item" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" character varying(2000),
        "speaker" character varying(200),
        "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_program_item" PRIMARY KEY ("id"),
        CONSTRAINT "FK_program_item_event" FOREIGN KEY ("event_id")
          REFERENCES "event" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_program_item_title" CHECK (
          length(btrim("title")) > 0
        ),
        CONSTRAINT "CHK_program_item_period" CHECK ("ends_at" > "starts_at")
      )
    `);

    // Every read of this table is "one event's programme, in order" — the public
    // landing page on every visit and the organizer's view on every edit. The id
    // is part of it so two parallel sessions never swap between two reads (F40).
    await queryRunner.query(`
      CREATE INDEX "IDX_program_item_event_period"
        ON "program_item" ("event_id", "starts_at", "ends_at", "id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "program_item"`);
  }
}
