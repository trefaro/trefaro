import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The QR check-in plug-in's own table (FR 3.16).
 *
 * The one migration of AP 7 of phase 4, and the fourth plug-in schema in this
 * repository. Explicit SQL, `down` written out, and `plugin_<key>_<name>` as
 * the name — a reader of `\dt` can tell at a glance which tables belong to a
 * plug-in and would go away with it.
 *
 * Stamped after the core migrations it points at — `registration` (phase 1) and
 * `admin_user` (phase 1) — and after the forum's, because both migration
 * streams are ordered together by timestamp and a reference cannot precede the
 * table it points at.
 *
 * The constraints carry decisions rather than types:
 *
 * - **The registration is the primary key** (E53). One registration, one code,
 *   one state; a surrogate id would allow two tickets for one person at one
 *   door and no way to say which is current.
 * - **`code` is unique across the instance.** A door resolves a scan without
 *   knowing which event it belongs to, which is what two events on one day
 *   need — and a collision would open somebody else's door, so the database
 *   refuses one rather than the code generator promising it will not happen.
 * - **`btrim(code) <> ''`**, the shape every text column of this application
 *   carries: a code made of spaces is refused by the database as well as by the
 *   DTO, so no future caller can create one.
 * - **`(checked_in_at IS NULL) = (checked_in_by IS NULL)`** would be wrong here
 *   and is deliberately absent: `checked_in_by` is `SET NULL`, so an admission
 *   outlives the account that granted it. What the pair does have is the
 *   ordering rule — nobody is let in before their ticket exists.
 *
 * One index beyond the two the constraints create: the admission list joins its
 * page of registrations against this table by id, which the primary key already
 * serves, and nothing here is read by time.
 */
export class CreateQrCheckinSchema1787900000000 implements MigrationInterface {
  name = 'CreateQrCheckinSchema1787900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "plugin_qr_checkin_ticket" (
        "registration_id" uuid NOT NULL,
        -- Opaque, this plug-in's own, never the signed self-service token
        -- (E53): that one can cancel a registration, and a QR code is
        -- photographed and held up at a door.
        "code" character varying(64) NOT NULL,
        "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        -- NULL means "not here yet", the same shape "confirmed_at" has on the
        -- registration itself (E32).
        "checked_in_at" TIMESTAMP WITH TIME ZONE,
        "checked_in_by" uuid,
        CONSTRAINT "PK_plugin_qr_checkin_ticket"
          PRIMARY KEY ("registration_id"),
        CONSTRAINT "UQ_plugin_qr_checkin_ticket_code" UNIQUE ("code"),
        CONSTRAINT "CHK_plugin_qr_checkin_ticket_code"
          CHECK (btrim("code") <> ''),
        -- Nobody is let in before their ticket exists.
        CONSTRAINT "CHK_plugin_qr_checkin_ticket_order"
          CHECK ("checked_in_at" IS NULL OR "checked_in_at" >= "issued_at"),
        -- The ticket belongs to the registration and goes with it; a plug-in's
        -- own table may say so towards a core table, which binds the plug-in
        -- and not the core (F21).
        CONSTRAINT "FK_plugin_qr_checkin_ticket_registration"
          FOREIGN KEY ("registration_id") REFERENCES "registration" ("id")
          ON DELETE CASCADE,
        -- Whoever opened the door may leave the organization; the admission
        -- stays.
        CONSTRAINT "FK_plugin_qr_checkin_ticket_checked_in_by"
          FOREIGN KEY ("checked_in_by") REFERENCES "admin_user" ("id")
          ON DELETE SET NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Nothing outside the plug-in was touched, so there is nothing else to undo.
    await queryRunner.query(`DROP TABLE "plugin_qr_checkin_ticket"`);
  }
}
