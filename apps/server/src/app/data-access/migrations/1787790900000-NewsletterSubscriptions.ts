import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The newsletter sign-up made in the app (FR 4.8, E45).
 *
 * One table, and it is the second source of an address the organization may
 * write to. The first has existed since phase 1 and is a column on a
 * registration — the checkbox in the form. This one exists for the person E45
 * is about: somebody who wants to hear from the organization without
 * registering for anything.
 *
 * Four decisions are in these lines, and two of them depart from the schema
 * sketch of the phase plan:
 *
 * 1. **No `confirmation_token_hash`** (F180). The sketch had one, drawn from
 *    the thesis' schema 5.3, but this application does not keep confirmation
 *    tokens: they are signed, self-contained and stored nowhere
 *    (`TokenSigner`), which is why no other double opt-in in this codebase has
 *    such a column. A column here would have been the only one of its kind and
 *    would have had to be kept in step with a mechanism it does not take part
 *    in.
 * 2. **`confirmed_at`, not `double_opt_in_confirmed_at`.** `registration` and
 *    `user_profile` both call this moment `confirmed_at`, and this is the same
 *    moment in the same kind of flow. Three names for one thing is how a
 *    reader of the schema learns to distrust it.
 * 3. **The series is nullable, and both branches are real.** `NULL` is the
 *    instance-wide list, which is what the sign-up on the start page writes; a
 *    series id is what the sign-up on that series' page writes. The overview
 *    says which of the two a consent is, so the column has a reader (F42).
 *    `ON DELETE CASCADE`: a deleted series takes the consents that were about
 *    it, because "news about this series" is not a promise anybody can keep
 *    afterwards.
 * 4. **`NULLS NOT DISTINCT` on the unique index** — the whole reason the index
 *    is written by hand. Postgres treats two `NULL`s as different values by
 *    default, so the plan's `unique (lower(email), event_series_id)` would have
 *    let one address sign up for the instance-wide list any number of times,
 *    which is exactly the row this application must not have twice: the second
 *    one is a second consent record for one statement, and the confirmation
 *    would be ambiguous. With the clause, one address has at most one consent
 *    per series and at most one instance-wide.
 *
 * `lower("email")` in the index and the address stored as it was typed: the
 * same split the profile table uses. An address is not case-sensitive as an
 * identity, and it is also somebody's own spelling of their own name.
 *
 * Nothing here is deleted by a switch (E14): turning the module off hides the
 * sign-up and the overview and keeps every consent, because a consent is a
 * record of something a person did.
 */
export class NewsletterSubscriptions1787790900000 implements MigrationInterface {
  name = 'NewsletterSubscriptions1787790900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "newsletter_subscription" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying(320) NOT NULL,
        -- NULL is the instance-wide list; an id is one series (see above).
        "event_series_id" uuid,
        -- NULL until the link in the mail is clicked. An unconfirmed row is a
        -- request, not a consent, and the overview does not list it (E45).
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_newsletter_subscription" PRIMARY KEY ("id"),
        CONSTRAINT "FK_newsletter_subscription_series"
          FOREIGN KEY ("event_series_id")
          REFERENCES "event_series" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_newsletter_subscription_email" CHECK (
          btrim("email") <> ''
        )
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_newsletter_subscription_address"
        ON "newsletter_subscription" (lower("email"), "event_series_id")
        NULLS NOT DISTINCT
    `);

    // The overview's page, newest consent first; every row it lists is
    // confirmed, so the index is partial for the same reason the query is.
    await queryRunner.query(`
      CREATE INDEX "IDX_newsletter_subscription_confirmed"
        ON "newsletter_subscription" ("confirmed_at" DESC)
        WHERE "confirmed_at" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // The table goes whole, which is the one case where dropping is honest:
    // it holds nothing that existed before this migration.
    await queryRunner.query(`DROP TABLE "newsletter_subscription"`);
  }
}
