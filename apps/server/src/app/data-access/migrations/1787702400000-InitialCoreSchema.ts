import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Core schema of phase 0: whitelabel configuration, module configuration and
 * Web Push subscriptions.
 *
 * Migrations are the only authority over the schema — `synchronize` stays off.
 * Written as explicit SQL rather than generated, so the constraints an NGO's
 * data depends on are reviewable in the diff.
 */
export class InitialCoreSchema1787702400000 implements MigrationInterface {
  name = 'InitialCoreSchema1787702400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "app_config" (
        "id" smallint NOT NULL,
        "primary_color" character varying(32) NOT NULL,
        "accent_color" character varying(32) NOT NULL,
        "logo_path" character varying(512),
        "font_family" character varying(256) NOT NULL,
        "default_locale" character varying(16) NOT NULL,
        "active_locales" character varying(16) array NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_config" PRIMARY KEY ("id"),
        -- One instance serves one organization: there is exactly one row.
        CONSTRAINT "CHK_app_config_singleton" CHECK ("id" = 1),
        -- English is mandatory alongside the national language.
        CONSTRAINT "CHK_app_config_locales" CHECK (cardinality("active_locales") > 0)
      )
    `);

    // Seed the single row so a fresh instance renders before anyone configures it.
    await queryRunner.query(`
      INSERT INTO "app_config"
        ("id", "primary_color", "accent_color", "font_family", "default_locale", "active_locales")
      VALUES
        (1, '#1f6f5c', '#e8a33d', 'system-ui, sans-serif', 'en', ARRAY['en'])
    `);

    await queryRunner.query(`
      CREATE TABLE "module_config" (
        "module_key" character varying(64) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "settings_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_module_config" PRIMARY KEY ("module_key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "push_subscription" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "endpoint" text NOT NULL,
        "p256dh_key" text NOT NULL,
        "auth_key" text NOT NULL,
        "user_agent" character varying(512),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_subscription" PRIMARY KEY ("id"),
        -- Re-subscribing the same browser updates its row instead of duplicating it.
        CONSTRAINT "UQ_push_subscription_endpoint" UNIQUE ("endpoint")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "push_subscription"`);
    await queryRunner.query(`DROP TABLE "module_config"`);
    await queryRunner.query(`DROP TABLE "app_config"`);
  }
}
