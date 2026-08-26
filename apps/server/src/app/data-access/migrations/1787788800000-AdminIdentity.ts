import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Administrator accounts and their sessions (FR 1.2, FR 1.3, F22).
 *
 * Written as explicit SQL rather than generated, so the constraints an
 * organization's access control depends on are reviewable in the diff.
 */
export class AdminIdentity1787788800000 implements MigrationInterface {
  name = 'AdminIdentity1787788800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_user" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying(320) NOT NULL,
        "name" character varying(120) NOT NULL,
        "password_hash" character varying(256) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_admin_user" PRIMARY KEY ("id")
      )
    `);

    // Case-insensitive: "Alex@example.org" and "alex@example.org" are one
    // person, and the login looks the address up the same way.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_admin_user_email" ON "admin_user" (lower("email"))
    `);

    await queryRunner.query(`
      CREATE TABLE "admin_session" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "admin_user_id" uuid NOT NULL,
        "token_hash" character(64) NOT NULL,
        "user_agent" character varying(512),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_admin_session" PRIMARY KEY ("id"),
        -- Only the hash of the token is stored; a database dump must not hand
        -- over live sessions.
        CONSTRAINT "UQ_admin_session_token_hash" UNIQUE ("token_hash"),
        -- Deleting an administrator ends their sessions in the same statement.
        -- That cascade is the whole reason sessions are rows and not JWTs.
        CONSTRAINT "FK_admin_session_admin_user" FOREIGN KEY ("admin_user_id")
          REFERENCES "admin_user" ("id") ON DELETE CASCADE
      )
    `);

    // The housekeeping sweep deletes by deadline.
    await queryRunner.query(`
      CREATE INDEX "IDX_admin_session_expires_at" ON "admin_session" ("expires_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admin_session"`);
    await queryRunner.query(`DROP TABLE "admin_user"`);
  }
}
