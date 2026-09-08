import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The discussion forum plug-in's own two tables (FR 4.6).
 *
 * The one migration of AP 4 of phase 4, and the third plug-in schema in this
 * repository. Explicit SQL, `down` written out, and `plugin_<key>_<name>` as the
 * names — a reader of `\dt` can tell at a glance which tables belong to a
 * plug-in and would go away with it.
 *
 * Stamped after the core migrations it points at — `event` (phase 1),
 * `user_profile` (phase 3) and `admin_user` (phase 1) — and after the proposals'
 * migration, because both migration streams are ordered together by timestamp
 * and a reference cannot precede the table it points at.
 *
 * The constraints carry decisions rather than types:
 *
 * - **The thread has no status** (F195). It is visible as soon as one of its
 *   posts is approved; `last_post_at` is the moment of the latest published
 *   post, or the thread's creation while there is none.
 * - **`status IN ('pending','approved','rejected')`** on the post — a decision,
 *   not a process (E51). No "under review", no second reviewer, and no fourth
 *   state that could be added without a migration saying so.
 * - **`(status = 'pending') = (decided_at IS NULL)`** — a decision has a time,
 *   and a pending row has none. The pair cannot drift apart, which is why the
 *   repository writes both in one statement.
 * - **`btrim(title) <> ''` and `btrim(body) <> ''`** — the same shape as
 *   `CHK_message_body`: a thread or a post made of spaces is refused by the
 *   database as well as by the DTO, so no future caller can create one.
 *
 * The indexes are the directions these rows are read in: an event's threads by
 * latest published activity, a thread's posts in the order they were written,
 * and the queue — the pending posts, newest first. The last one is partial: the
 * `WHERE` is the state, so the state needs no column of its own in the key.
 */
export class CreateForumSchema1787890000000 implements MigrationInterface {
  name = 'CreateForumSchema1787890000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "plugin_forum_thread" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        -- The latest published post, or the thread's own creation until there
        -- is one (F195). Recomputed on every decision, never on a post's arrival.
        "last_post_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plugin_forum_thread" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_plugin_forum_thread_title"
          CHECK (btrim("title") <> ''),
        -- The event's forum goes when the event goes; a plug-in that left it
        -- behind would keep rows nothing can reach.
        CONSTRAINT "FK_plugin_forum_thread_event"
          FOREIGN KEY ("event_id") REFERENCES "event" ("id") ON DELETE CASCADE,
        -- Whoever opened the thread: a closed account takes what it wrote.
        CONSTRAINT "FK_plugin_forum_thread_created_by"
          FOREIGN KEY ("created_by") REFERENCES "user_profile" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_plugin_forum_thread_event_activity"
        ON "plugin_forum_thread" ("event_id", "last_post_at" DESC, "id")
    `);

    await queryRunner.query(`
      CREATE TABLE "plugin_forum_post" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "thread_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "body" text NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "decided_at" TIMESTAMP WITH TIME ZONE,
        "decided_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plugin_forum_post" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_plugin_forum_post_status"
          CHECK ("status" IN ('pending', 'approved', 'rejected')),
        -- A decision has a moment, and a pending post has not been decided.
        CONSTRAINT "CHK_plugin_forum_post_decided"
          CHECK (("status" = 'pending') = ("decided_at" IS NULL)),
        CONSTRAINT "CHK_plugin_forum_post_body"
          CHECK (btrim("body") <> ''),
        CONSTRAINT "FK_plugin_forum_post_thread"
          FOREIGN KEY ("thread_id") REFERENCES "plugin_forum_thread" ("id") ON DELETE CASCADE,
        -- A post is attributed by nature (E58): a closed account takes its
        -- posts, and there is no anonymous remainder to keep.
        CONSTRAINT "FK_plugin_forum_post_author"
          FOREIGN KEY ("author_id") REFERENCES "user_profile" ("id") ON DELETE CASCADE,
        -- Whoever decided may leave the organization; the decision stays.
        CONSTRAINT "FK_plugin_forum_post_decided_by"
          FOREIGN KEY ("decided_by") REFERENCES "admin_user" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_plugin_forum_post_thread"
        ON "plugin_forum_post" ("thread_id", "created_at", "id")
    `);

    // The queue asks for one state, not for all of them.
    await queryRunner.query(`
      CREATE INDEX "IDX_plugin_forum_post_pending"
        ON "plugin_forum_post" ("created_at" DESC, "id")
        WHERE "status" = 'pending'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Posts first, because they point at threads; nothing outside the plug-in
    // was touched, so there is nothing else to undo.
    await queryRunner.query(`DROP TABLE "plugin_forum_post"`);
    await queryRunner.query(`DROP TABLE "plugin_forum_thread"`);
  }
}
