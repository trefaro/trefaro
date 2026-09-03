import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A push subscription may belong to an account — and may not (FR 3.15, E43).
 *
 * The column phase 0 deliberately did not add. `push_subscription` was written
 * before `user_profile` existed, and a `user_id` without its foreign key would
 * have been a column the database could not keep honest; the entity says so in
 * a comment and `todo.md` has carried the entry since. It can be added now, so
 * it is added now, with the constraint that was the whole reason to wait.
 *
 * Three decisions travel in these few lines:
 *
 * 1. **Nullable, and that is the feature** (E43). That an event was moved is
 *    public information — somebody who subscribed from a landing page without
 *    ever making an account may have it. `NOT NULL` would have made a browser
 *    useless until its owner registered, and the endpoint has been anonymous
 *    since phase 0.
 * 2. **`ON DELETE CASCADE`**: a deleted profile takes its devices with it.
 *    There is nothing left to notify, and a subscription pointing at a gone
 *    account is the kind of row that outlives the reason it was written.
 * 3. **The endpoint stays the identity.** The unique key is unchanged — one row
 *    per browser, not one per browser and account. A device that signs in
 *    re-posts its subscription and the row is *rebound*; signing out rebinds it
 *    to nobody. Two rows for one endpoint would mean two notifications for one
 *    device, and the shared tablet in an office would keep notifying whoever
 *    used it last.
 *
 * The partial index is for the read that runs on every event change: the
 * devices without an account, which are one of that notification's two
 * audiences. The other audience is reached through this column and finds the
 * primary key of `user_profile` at the other end.
 */
export class PushSubscriptionOwner1787790800000 implements MigrationInterface {
  name = 'PushSubscriptionOwner1787790800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "push_subscription"
        ADD COLUMN "user_id" uuid,
        ADD CONSTRAINT "FK_push_subscription_user"
          FOREIGN KEY ("user_id") REFERENCES "user_profile" ("id")
          ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_push_subscription_user"
        ON "push_subscription" ("user_id")
        WHERE "user_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_push_subscription_anonymous"
        ON "push_subscription" ("id")
        WHERE "user_id" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_push_subscription_anonymous"`);
    await queryRunner.query(`DROP INDEX "IDX_push_subscription_user"`);
    // The rows stay: a subscription is a browser's, and it was valid before
    // this column existed. What goes is the knowledge of whose it is.
    await queryRunner.query(`
      ALTER TABLE "push_subscription"
        DROP CONSTRAINT "FK_push_subscription_user",
        DROP COLUMN "user_id"
    `);
  }
}
