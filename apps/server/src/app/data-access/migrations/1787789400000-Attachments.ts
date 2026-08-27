import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Files uploaded with a registration (E9, F12, FR 3.5).
 *
 * What this table decides rather than leaving to the application:
 *
 * - **A file cannot outlive its registration.** The foreign key cascades, which
 *   is why the owner is a real key and not the `owner_type`/`owner_id` pair the
 *   schema draft sketched (F37): a polymorphic pair cannot be constrained, and
 *   the very first promise this table has to keep is that nothing points at a
 *   registration that is gone. The bytes are removed by the business layer
 *   before the rows are, because a cascade deletes no files.
 * - **One file per field.** A second submission of the same form replaces what
 *   was uploaded rather than piling up versions, and only a unique index settles
 *   that between two submissions arriving at once.
 * - **Every column that describes the bytes is mandatory.** A row that does not
 *   know its own size or type describes nothing an organizer can act on.
 *
 * `field_key` deliberately has no foreign key to `registration_field_def`:
 * deleting a question does not delete the answers to it (F34), and a file is an
 * answer. It is a key, not a reference — checked to look like one.
 */
export class Attachments1787789400000 implements MigrationInterface {
  name = 'Attachments1787789400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attachment" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "registration_id" uuid NOT NULL,
        "field_key" character varying(80) NOT NULL,
        "file_path" character varying(512) NOT NULL,
        "file_name" character varying(200) NOT NULL,
        "mime_type" character varying(128) NOT NULL,
        "size_bytes" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attachment" PRIMARY KEY ("id"),
        CONSTRAINT "FK_attachment_registration" FOREIGN KEY ("registration_id")
          REFERENCES "registration" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_attachment_field_key" CHECK (
          "field_key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        ),
        CONSTRAINT "CHK_attachment_file_path" CHECK (
          length(btrim("file_path")) > 0
          -- Relative to the upload volume, and never a way out of it.
          AND "file_path" NOT LIKE '/%'
          AND "file_path" NOT LIKE '%..%'
        ),
        CONSTRAINT "CHK_attachment_file_name" CHECK (
          length(btrim("file_name")) > 0
        ),
        CONSTRAINT "CHK_attachment_size" CHECK ("size_bytes" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_attachment_registration_field"
        ON "attachment" ("registration_id", "field_key")
    `);

    // Every read is "the files of this registration"; every delete but one is
    // "the files of these registrations".
    await queryRunner.query(`
      CREATE INDEX "IDX_attachment_registration"
        ON "attachment" ("registration_id")
    `);

    // The path is what the volume is asked for, and what a consistency check
    // between database and volume would join on.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_attachment_file_path"
        ON "attachment" ("file_path")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "attachment"`);
  }
}
