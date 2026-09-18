import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A thread survives the erasure of whoever opened it (E65, AP 6 of phase 5).
 *
 * `created_by` was `NOT NULL` with `ON DELETE CASCADE`, and for a **post** that
 * is still right: a post is attributed by nature (E58), it is one person's
 * words, and a closed account takes them. A **thread** is not that. It is the
 * container other people's posts are in, and cascading it would delete their
 * published replies along with the opener's account — the one case where
 * erasing one person's data erases somebody else's.
 *
 * So: nullable, `ON DELETE SET NULL`, which is the rule the schema already
 * follows for `decided_by` on the same plug-in's tables — whoever made a
 * decision may go, the decision stays. The payload needed no change at all:
 * `author` on a thread has been nullable since AP 4 of phase 4 (F195), because
 * a thread is drawn from its posts and could always be looked at by somebody
 * who may not see the first one.
 *
 * **Why this ALTER is in the plug-in and not in the core's erasure migration.**
 * `plugin_forum_thread` is the forum's table, and a core migration touching it
 * would be the core reaching into a plug-in's schema — the mirror image of what
 * F21 forbids. The erasure statement in the core says nothing about this table
 * either; it deletes a `user_profile` row, and this foreign key is what decides
 * what that means here. That is the whole mechanism: a plug-in declares what
 * happens to its rows when a person is erased, and the core never enumerates
 * them in SQL.
 *
 * The first post of a thread still cascades, and a thread whose posts are all
 * gone is invisible rather than orphaned — visibility is a property of having a
 * published post (F195), so an emptied thread simply stops being listed.
 */
export class ThreadOutlivesItsOpener1787911000000 implements MigrationInterface {
  name = 'ThreadOutlivesItsOpener1787911000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "plugin_forum_thread"
        DROP CONSTRAINT "FK_plugin_forum_thread_created_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "plugin_forum_thread"
        ALTER COLUMN "created_by" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "plugin_forum_thread"
        ADD CONSTRAINT "FK_plugin_forum_thread_created_by"
        FOREIGN KEY ("created_by") REFERENCES "user_profile" ("id")
        ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Going back means the column is `NOT NULL` again, and a thread whose
    // opener has been erased has no value to put there. Those threads are
    // deleted — which is exactly what the old cascade would have done to them,
    // so `down` restores the old state of the data as well as of the schema.
    await queryRunner.query(`
      DELETE FROM "plugin_forum_thread" WHERE "created_by" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "plugin_forum_thread"
        DROP CONSTRAINT "FK_plugin_forum_thread_created_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "plugin_forum_thread"
        ALTER COLUMN "created_by" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "plugin_forum_thread"
        ADD CONSTRAINT "FK_plugin_forum_thread_created_by"
        FOREIGN KEY ("created_by") REFERENCES "user_profile" ("id")
        ON DELETE CASCADE
    `);
  }
}
