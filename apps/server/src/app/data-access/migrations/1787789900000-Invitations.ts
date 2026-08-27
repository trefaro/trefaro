import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inviting former participants (FR 2.4, F24) — AP 12.
 *
 * Two tables and one index on `registration`. What the tables are *not* is the
 * point: there is no address list here. `invitation` holds the message an
 * organizer wrote, `invitation_recipient` points at the registrations it went
 * to, and every address is read through those foreign keys at send time. So
 * this feature stores no second copy of anybody's e-mail address, and erasing a
 * registration (the phase 5 functions) erases its place in every invitation
 * with it.
 *
 * Three decisions live in this SQL rather than only in the service:
 *
 * 1. **A recipient is a registration, never an address** (F55). The foreign key
 *    is what makes "only addresses that registered for this series and
 *    confirmed" structurally true instead of a filter somebody has to remember.
 *    An organizer cannot mail an address through this feature that is not
 *    already in the instance — not by mistake and not on purpose.
 * 2. **The progress of a send is the rows, not a counter.** `status` per
 *    recipient, and the invitation's state is derived from counting them
 *    (`invitationState` in `shared-models`). A denormalized `sent_count` would
 *    be a second truth, and the first crash mid-send would make the two
 *    disagree — with no way to tell which one is right.
 * 3. **An invitation outlives the event it invited to.** `event_id` is nullable
 *    with `ON DELETE SET NULL`: the record of who was written to is the
 *    organization's, and it must not disappear because the event was deleted
 *    afterwards. The series does take its invitations with it (`CASCADE`) —
 *    without the series there is no audience the record could describe.
 *
 * `status` carries a `CHECK` here, unlike `media_link.kind` in AP 11: these
 * three values are not a product decision but the state machine of the sender,
 * and a fourth value would silently make a recipient invisible to both the
 * "still pending" query and the counts.
 */
export class Invitations1787789900000 implements MigrationInterface {
  name = 'Invitations1787789900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "invitation" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "series_id" uuid NOT NULL,
        "event_id" uuid,
        "subject" character varying(200) NOT NULL,
        "body" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "finished_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_invitation" PRIMARY KEY ("id"),
        CONSTRAINT "FK_invitation_series" FOREIGN KEY ("series_id")
          REFERENCES "event_series" ("id") ON DELETE CASCADE,
        -- See the class comment: the record of a send outlives its event.
        CONSTRAINT "FK_invitation_event" FOREIGN KEY ("event_id")
          REFERENCES "event" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_invitation_subject" CHECK (
          length(btrim("subject")) > 0
        ),
        CONSTRAINT "CHK_invitation_body" CHECK (length(btrim("body")) > 0)
      )
    `);

    // The organizer's list of what was sent for a series, newest first.
    await queryRunner.query(`
      CREATE INDEX "IDX_invitation_series_created_at"
        ON "invitation" ("series_id", "created_at" DESC, "id")
    `);

    await queryRunner.query(`
      CREATE TABLE "invitation_recipient" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "invitation_id" uuid NOT NULL,
        "registration_id" uuid NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "failure" text,
        "sent_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_invitation_recipient" PRIMARY KEY ("id"),
        CONSTRAINT "FK_invitation_recipient_invitation"
          FOREIGN KEY ("invitation_id")
          REFERENCES "invitation" ("id") ON DELETE CASCADE,
        -- An erased registration takes its place in every invitation with it.
        CONSTRAINT "FK_invitation_recipient_registration"
          FOREIGN KEY ("registration_id")
          REFERENCES "registration" ("id") ON DELETE CASCADE,
        -- One mail per address per invitation, decided by the database: the
        -- selection arrives from a client and may name the same person twice.
        CONSTRAINT "UQ_invitation_recipient"
          UNIQUE ("invitation_id", "registration_id"),
        CONSTRAINT "CHK_invitation_recipient_status" CHECK (
          "status" IN ('pending', 'sent', 'failed')
        ),
        CONSTRAINT "CHK_invitation_recipient_sent_at" CHECK (
          "status" <> 'sent' OR "sent_at" IS NOT NULL
        )
      )
    `);

    // What the sender asks for after every single mail: the next recipient of
    // this invitation that has not been attempted yet. Partial, because the
    // rows it excludes are the overwhelming majority once a send is done.
    await queryRunner.query(`
      CREATE INDEX "IDX_invitation_recipient_pending"
        ON "invitation_recipient" ("invitation_id", "id")
        WHERE "status" = 'pending'
    `);

    // And what the organizer's list of past invitations counts over.
    await queryRunner.query(`
      CREATE INDEX "IDX_invitation_recipient_invitation"
        ON "invitation_recipient" ("invitation_id", "status")
    `);

    // The audience query (FR 2.4) groups a series' confirmed registrations by
    // address, and the objection writes every row of one address at once (F57).
    // Both go through the address, which until now was only ever looked up
    // together with an event.
    await queryRunner.query(`
      CREATE INDEX "IDX_registration_email"
        ON "registration" (lower("email"))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_registration_email"`);
    await queryRunner.query(`DROP TABLE "invitation_recipient"`);
    await queryRunner.query(`DROP TABLE "invitation"`);
  }
}
