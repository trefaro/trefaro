import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The programme proposals plug-in's own table (FR 3.13, FR 3.14).
 *
 * The one migration of AP 2 of phase 4, and the second plug-in schema in this
 * repository. Explicit SQL, `down` written out, and `plugin_<key>_<name>` as the
 * name — a reader of `\dt` can tell at a glance which tables belong to a
 * plug-in and would go away with it.
 *
 * Stamped after the core migrations it points at — `event` (phase 1),
 * `user_profile` (phase 3) and `admin_user` (phase 1) — because both migration
 * streams are ordered together by timestamp and a reference cannot precede the
 * table it points at.
 *
 * Three constraints carry decisions rather than types:
 *
 * - **`status IN ('pending','approved','rejected')`** — a decision, not a
 *   process (E51). No "under review", no second reviewer, and no fourth state
 *   that could be added without a migration saying so.
 * - **`(status = 'pending') = (decided_at IS NULL)`** — a decision has a time,
 *   and a pending row has none. The pair cannot drift apart, which is why the
 *   repository writes both in one statement.
 * - **`btrim(title) <> ''` and `btrim(description) <> ''`** — the same shape as
 *   `CHK_message_body`: a proposal made of spaces is refused by the database as
 *   well as by the DTO, so no future caller can create one.
 *
 * The two indexes are the two directions these rows are read in: the
 * organizer's queue for one event in one state, and "my proposals" for one
 * person. Both end with the primary key implicitly, which is what keeps a
 * paginated list stable between two pages.
 */
export class CreateProgramProposalsSchema1787880000000 implements MigrationInterface {
  name = 'CreateProgramProposalsSchema1787880000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "plugin_program_proposals_proposal" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "decided_at" TIMESTAMP WITH TIME ZONE,
        "decided_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plugin_program_proposals_proposal" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_plugin_program_proposals_status"
          CHECK ("status" IN ('pending', 'approved', 'rejected')),
        -- A decision has a moment, and a pending proposal has not been decided.
        CONSTRAINT "CHK_plugin_program_proposals_decided"
          CHECK (("status" = 'pending') = ("decided_at" IS NULL)),
        CONSTRAINT "CHK_plugin_program_proposals_title"
          CHECK (btrim("title") <> ''),
        CONSTRAINT "CHK_plugin_program_proposals_description"
          CHECK (btrim("description") <> ''),
        -- The event's proposals go when the event goes; a plug-in that left
        -- them behind would keep rows nothing can reach.
        CONSTRAINT "FK_plugin_program_proposals_event"
          FOREIGN KEY ("event_id") REFERENCES "event" ("id") ON DELETE CASCADE,
        -- And a closed account takes what it wrote: a proposal is attributed by
        -- nature (E58), so there is no anonymous remainder to keep.
        CONSTRAINT "FK_plugin_program_proposals_author"
          FOREIGN KEY ("author_id") REFERENCES "user_profile" ("id") ON DELETE CASCADE,
        -- Whoever decided may leave the organization; the decision stays.
        CONSTRAINT "FK_plugin_program_proposals_decided_by"
          FOREIGN KEY ("decided_by") REFERENCES "admin_user" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_plugin_program_proposals_event_status"
        ON "plugin_program_proposals_proposal"
           ("event_id", "status", "created_at" DESC, "id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_plugin_program_proposals_author"
        ON "plugin_program_proposals_proposal"
           ("author_id", "created_at" DESC, "id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // The table and its indexes; nothing outside the plug-in was touched, so
    // there is nothing else to undo.
    await queryRunner.query(`DROP TABLE "plugin_program_proposals_proposal"`);
  }
}
