import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Participant accounts and their sessions (FR 4.1, FR 4.2 — E31, E32, E34).
 *
 * Explicit SQL rather than generated, like every migration before it: the
 * constraints an organization's access control depends on belong in the diff.
 *
 * Two decisions are carried by this file rather than by any service:
 *
 * 1. **The address is the identity** (E31). One functional unique index over
 *    `lower(email)`, instance-wide, and no foreign key to `registration` in
 *    either direction. The registrations of a person are found by address
 *    equality, exactly as an objection applies to every registration of an
 *    address (F57) — which means nothing has to be linked up for the rows that
 *    already exist, and there is no second truth that can drift.
 * 2. **A participant session is a second session, not a role** (E34). Its own
 *    table, shaped like `admin_session` and swept the same way, because a role
 *    column in a shared session table would move authorization into the cookie
 *    — and an organizer who is also a participant wants both open at once.
 *
 * `confirmed_at` is the double opt-in (E32): NULL until the person behind the
 * address said so, and no session is issued before it. The columns the profile
 * itself needs — picture, field of activity, configurable answers, `searchable`
 * — arrive with the work package that reads and writes them; a column nothing
 * reads yet looks like a feature that exists (F42).
 *
 * It also clears one thing away, and that is the third decision in this file:
 * the `module_config` row the retired `profiles` descriptor left behind (see
 * `core-modules.ts`). Phase 2 withdrew five placeholder keys and deliberately
 * left their rows alone, on the reasoning that switching a module off never
 * deletes anything. That reasoning holds for a `true` row, which is somebody
 * saying "I want this" — and fails for a `false` one, which is a default from a
 * time when the switch did nothing. Left standing it would silently overrule
 * the descriptor the day the module came back, and the organizer would find
 * profiles switched off having never switched them off.
 *
 * So the `false` rows of the three returning keys go, and `ensureDefaults`
 * writes them again on the next boot from whatever their descriptor then says.
 * The `true` rows stay: an instance that had `chat` switched on finds it
 * switched on again, exactly as phase 2 promised.
 */
export class UserAccounts1787790500000 implements MigrationInterface {
  name = 'UserAccounts1787790500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_profile" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying(320) NOT NULL,
        "password_hash" character varying(256) NOT NULL,
        "first_name" character varying(100) NOT NULL,
        "last_name" character varying(100) NOT NULL,
        -- BCP 47, so a regional tag is its own language (F90). No default: the
        -- instance's default language is a configured value, and a copy of it
        -- here would be a second answer to the same question.
        "preferred_locale" character varying(16) NOT NULL,
        -- NULL means "not confirmed yet", not "confirmed at an unknown time".
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_profile" PRIMARY KEY ("id")
      )
    `);

    // Instance-wide and case-insensitive: "Alex@example.org" and
    // "alex@example.org" are one person (E31), and every lookup — login,
    // repeated registration, and later "which registrations are mine" — asks
    // the question the same way.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_user_profile_email"
        ON "user_profile" (lower("email"))
    `);

    await queryRunner.query(`
      CREATE TABLE "user_session" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token_hash" character(64) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_user_session" PRIMARY KEY ("id"),
        -- Only the hash of the token is stored; a database dump must not hand
        -- over live sessions.
        CONSTRAINT "UQ_user_session_token_hash" UNIQUE ("token_hash"),
        -- Deleting a profile ends its sessions in the same statement. That
        -- cascade is the whole reason sessions are rows and not signed tokens.
        CONSTRAINT "FK_user_session_user_profile" FOREIGN KEY ("user_id")
          REFERENCES "user_profile" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      DELETE FROM "module_config"
        WHERE "module_key" IN ('profiles', 'chat', 'profile-search')
          AND "enabled" = false
    `);

    // The housekeeping sweep deletes by deadline, like the administrative one.
    // No `user_agent` here, unlike `admin_session`: nothing shows a participant
    // their sessions, and a column nobody reads is a column nobody maintains.
    await queryRunner.query(`
      CREATE INDEX "IDX_user_session_expires_at"
        ON "user_session" ("expires_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_session"`);
    await queryRunner.query(`DROP TABLE "user_profile"`);
    // The removed flag rows are not restored: their value was a default nobody
    // chose, and inventing one back would be the mistake this migration exists
    // to undo. The next boot seeds whatever the descriptors then say.
  }
}
