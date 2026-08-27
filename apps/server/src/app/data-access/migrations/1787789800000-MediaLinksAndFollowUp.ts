import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * External media links and the follow-up text (FR 3.6, F10) — AP 11.
 *
 * Two things arrive together because they are the same feature seen from two
 * sides: what an event leaves behind. The text says it, the links point at it.
 *
 * - **`event.follow_up_body`** — one nullable text column, not a table. There is
 *   one follow-up per event, written before the event and shown after it (F50);
 *   a table would suggest there can be several, and then something would have to
 *   decide which one is *the* one.
 * - **`media_link`** — external URLs per event and, optionally, per session.
 *   Only links: no upload, no transcoding, no player (F10, variant a). The
 *   column list is deliberately short — an organizer types a title and a URL,
 *   and nothing here ever asks the target what it is called.
 *
 * Three decisions are in the SQL rather than only in the service:
 *
 * 1. **A session's link belongs to the session's event.** The foreign key is
 *    composite — `(program_item_id, event_id)` against `program_item (id,
 *    event_id)` — so a link cannot name a session of a different event at all,
 *    rather than being refused by a check somebody has to remember to write. The
 *    unique constraint added to `program_item` below exists to be referenced;
 *    `(id)` is already unique, and Postgres needs the pair declared before it
 *    can be pointed at. With `MATCH SIMPLE` (the default) a row whose
 *    `program_item_id` is NULL passes the constraint untested, which is exactly
 *    what an event-level link is.
 * 2. **A deleted session takes its links with it.** `ON DELETE CASCADE`, the
 *    same reasoning as its sign-ups (AP 9): a session that is not happening has
 *    no recording. The organizer can add the link to the event instead, which is
 *    where a recording without a session belongs.
 * 3. **No `sort` column** — the schema draft in section 5.3 had one. The kind is
 *    the order (stream, then recording, then material) and within a kind it is
 *    the order they were added; a position column beside that would be a second
 *    ordering nobody maintains (F52, the same reasoning as F40 for
 *    `program_item`).
 *
 * `kind` carries no `CHECK`, deliberately: the set of kinds is a product
 * decision that lives in `shared-models` and is enforced by the DTO, exactly as
 * `event_type`, `status` and `registration_field.type` are. A constraint here
 * would be a second list to keep in step, and the failure it prevents — a value
 * no client can send — is not the one that happens.
 */
export class MediaLinksAndFollowUp1787789800000 implements MigrationInterface {
  name = 'MediaLinksAndFollowUp1787789800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "event" ADD COLUMN "follow_up_body" text
    `);

    // Referenced by media_link's composite foreign key below. Not a new rule:
    // the primary key already makes the pair unique, and this is how it is said
    // in a way another table can point at.
    await queryRunner.query(`
      ALTER TABLE "program_item"
        ADD CONSTRAINT "UQ_program_item_id_event" UNIQUE ("id", "event_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "media_link" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "program_item_id" uuid,
        "kind" character varying(16) NOT NULL,
        "title" character varying(200) NOT NULL,
        "url" character varying(512) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_media_link" PRIMARY KEY ("id"),
        CONSTRAINT "FK_media_link_event" FOREIGN KEY ("event_id")
          REFERENCES "event" ("id") ON DELETE CASCADE,
        -- The pair, so a link can only name a session of its own event.
        CONSTRAINT "FK_media_link_program_item"
          FOREIGN KEY ("program_item_id", "event_id")
          REFERENCES "program_item" ("id", "event_id") ON DELETE CASCADE
      )
    `);

    // The only read there is: every link of one event, in the order they were
    // added. The kind's order is applied in the business layer, where the list
    // of kinds lives (F52).
    await queryRunner.query(`
      CREATE INDEX "IDX_media_link_event"
        ON "media_link" ("event_id", "created_at", "id")
    `);

    // Not for a query — for the cascade: deleting a session has to find its
    // links, and without this that is a scan of every link in the instance.
    await queryRunner.query(`
      CREATE INDEX "IDX_media_link_program_item"
        ON "media_link" ("program_item_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "media_link"`);
    await queryRunner.query(`
      ALTER TABLE "program_item" DROP CONSTRAINT "UQ_program_item_id_event"
    `);
    await queryRunner.query(`
      ALTER TABLE "event" DROP COLUMN "follow_up_body"
    `);
  }
}
