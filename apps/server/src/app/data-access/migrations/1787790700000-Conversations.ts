import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Conversations, messages and the pictures in them (FR 4.5 — E38, E39, E40).
 *
 * The first migration of this phase that adds tables rather than columns, and
 * the only one that touches a core table from phase 1 — `attachment`, and only
 * by widening it. Six decisions are carried by this file:
 *
 * 1. **A conversation has three kinds, and the database knows the shape of
 *    each** (E39). `group` needs an event and a topic, `organizer_contact`
 *    needs the guest's address, `direct` has none of the three.
 *    `CHK_conversation_shape` says so in one expression rather than leaving it
 *    to three services to remember — two of which do not exist yet (AP 9, AP
 *    10), which is exactly why the constraint is written now.
 * 2. **Two accounts have one direct conversation, and that is a constraint.**
 *    `direct_key` holds the two profile ids in a fixed order, unique, and
 *    required for exactly `type = 'direct'`. It is the one addition to the
 *    schema sketch of the phase plan, and it earns its 73 bytes: without it two
 *    simultaneous "write to this person" clicks create two conversations
 *    between the same two people and split their messages across both. The
 *    alternative — read, then insert — is the race the sketch could not
 *    express, and "Zugehörigkeit garantiert die Datenbank" (F54) says where
 *    such a rule belongs.
 * 3. **Read is a property of the member, not of the message** (E38).
 *    `conversation_member.last_read_at`, not `message.read_at` as the schema
 *    draft 5.3 had it: in a group "read" is true per recipient, so the draft's
 *    column would need one row per message **and** recipient. Unread is
 *    **counted** from this timestamp and never stored, the same rule the
 *    dispatch progress follows (F56).
 * 4. **A membership has no foreign key on `member_id`**, and that price is
 *    deliberate: the column points at `admin_user` or at `user_profile`
 *    depending on `member_type`. The alternative is two nullable columns with a
 *    check, and a membership is not a row that exists without its conversation
 *    — which the composite primary key and the cascade do guarantee.
 * 5. **A message is text, picture or both — never nothing** (E40).
 *    `CHK_message_content`, plus `body` may not be whitespace: a conversation
 *    that can be filled with blank lines is a conversation nobody can read.
 * 6. **The picture of a message is an `attachment` row in its own subtree.**
 *    `registration_id` and `field_key` become nullable together — a chat
 *    picture answers no form question — and `CHK_attachment_owner` makes that
 *    an exclusive arc the database can actually check. `CHK_attachment_area`
 *    adds the third layer of E19 on top of the route (which takes no path) and
 *    the image service (which reads only from its own area): a registration's
 *    file lives under `attachments/`, a message's picture under `messages/`,
 *    and no row can name the other one's subtree. An operator can tell the two
 *    apart with `ls`, which is the version of that promise that can be
 *    verified.
 *
 * `ON DELETE SET NULL` from `message` to `attachment`, not `CASCADE`: a deleted
 * file does not delete what somebody wrote. Together with
 * `CHK_message_content` that says something stricter than either clause alone,
 * and it is worth naming because it will surprise the next person who tries:
 * the file of a message that is a picture **alone** cannot be deleted at all —
 * the row would be left with neither text nor picture, and the check refuses
 * it. So a picture may be taken off a message that also has words, and a
 * message can never be emptied out. Whoever really wants the file gone deletes
 * the message, and nothing in this application does (E14).
 *
 * The other direction is the obligation this migration leaves behind — deleting an **event** cascades
 * through `conversation` to `message`, and a cascade removes rows but no files
 * (E9). Nothing creates a group conversation until AP 10, so no such row can
 * exist yet; the purge belongs to that package, where it can be tested against
 * a group that actually exists. Noted in `todo.md`.
 */
export class Conversations1787790700000 implements MigrationInterface {
  name = 'Conversations1787790700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "conversation" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        -- direct | group | organizer_contact (E39)
        "type" character varying(24) NOT NULL,
        -- A group belongs to an event and goes when the event goes; the other
        -- two kinds have no event at all.
        "event_id" uuid,
        "topic" character varying(200),
        -- The address of somebody without an account, on the conversation
        -- rather than on an invented account row (E39).
        "guest_email" character varying(320),
        "guest_name" character varying(200),
        -- The two profile ids of a direct conversation, smaller one first.
        -- Written by the data access layer and read by nobody else.
        "direct_key" character varying(80),
        -- The sort order of the overview. A column and not a subquery over the
        -- messages: the list is read far more often than it is written, and no
        -- counter stands beside it — unread is counted (E38, F56).
        "last_message_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversation" PRIMARY KEY ("id"),
        CONSTRAINT "FK_conversation_event" FOREIGN KEY ("event_id")
          REFERENCES "event" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_conversation_type" CHECK (
          "type" IN ('direct', 'group', 'organizer_contact')
        ),
        -- One expression for all three kinds, so a service that forgets half of
        -- its own shape cannot write the row (E39).
        CONSTRAINT "CHK_conversation_shape" CHECK (
          CASE "type"
            WHEN 'group' THEN
              "event_id" IS NOT NULL AND "topic" IS NOT NULL
              AND "guest_email" IS NULL AND "guest_name" IS NULL
            -- Only the address, as the phase plan has it. Whether a contact
            -- request also names an event and a subject is AP 9's call, and a
            -- constraint written here would be this package deciding it.
            WHEN 'organizer_contact' THEN
              "guest_email" IS NOT NULL
            ELSE
              "event_id" IS NULL AND "topic" IS NULL
              AND "guest_email" IS NULL AND "guest_name" IS NULL
          END
        ),
        -- Required for a direct conversation and forbidden for the other two,
        -- which is what makes the unique index below mean what it says.
        CONSTRAINT "CHK_conversation_direct_key" CHECK (
          ("type" = 'direct') = ("direct_key" IS NOT NULL)
        ),
        CONSTRAINT "UQ_conversation_direct_key" UNIQUE ("direct_key")
      )
    `);

    // "My conversations" is a join from the membership; this index serves the
    // sort the overview asks for once the rows are found.
    await queryRunner.query(`
      CREATE INDEX "IDX_conversation_last_message_at"
        ON "conversation" ("last_message_at" DESC, "id" DESC)
    `);

    // The organizer's overview (AP 10) reads one event's conversations.
    await queryRunner.query(`
      CREATE INDEX "IDX_conversation_event" ON "conversation" ("event_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "conversation_member" (
        "conversation_id" uuid NOT NULL,
        -- admin | user. No foreign key on member_id — see the class comment.
        "member_type" character varying(8) NOT NULL,
        "member_id" uuid NOT NULL,
        -- NULL means "has read nothing yet", which is not the same as having
        -- read up to the moment they joined: somebody added to a group sees
        -- what was said before they arrived.
        "last_read_at" TIMESTAMP WITH TIME ZONE,
        "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversation_member"
          PRIMARY KEY ("conversation_id", "member_type", "member_id"),
        CONSTRAINT "FK_conversation_member_conversation"
          FOREIGN KEY ("conversation_id")
          REFERENCES "conversation" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_conversation_member_type" CHECK (
          "member_type" IN ('admin', 'user')
        )
      )
    `);

    // The one question every request in this module starts with: which
    // conversations is this person in, and is this one of them.
    await queryRunner.query(`
      CREATE INDEX "IDX_conversation_member_member"
        ON "conversation_member" ("member_type", "member_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "message" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "conversation_id" uuid NOT NULL,
        -- admin | user | guest (E39)
        "sender_type" character varying(8) NOT NULL,
        "sender_id" uuid,
        "body" text,
        "attachment_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message" PRIMARY KEY ("id"),
        CONSTRAINT "FK_message_conversation" FOREIGN KEY ("conversation_id")
          REFERENCES "conversation" ("id") ON DELETE CASCADE,
        -- SET NULL, not CASCADE: a removed file does not remove what somebody
        -- wrote. Whoever clears files calls the purge first, while the rows can
        -- still say which files are meant (E9).
        CONSTRAINT "FK_message_attachment" FOREIGN KEY ("attachment_id")
          REFERENCES "attachment" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_message_sender_type" CHECK (
          "sender_type" IN ('admin', 'user', 'guest')
        ),
        -- A guest has no account to point at, and everybody else has one.
        CONSTRAINT "CHK_message_sender_id" CHECK (
          ("sender_type" = 'guest') = ("sender_id" IS NULL)
        ),
        -- Text, picture or both — never nothing (E40).
        CONSTRAINT "CHK_message_content" CHECK (
          "body" IS NOT NULL OR "attachment_id" IS NOT NULL
        ),
        -- And a body that is only whitespace is not a body.
        CONSTRAINT "CHK_message_body" CHECK (
          "body" IS NULL OR length(btrim("body")) > 0
        )
      )
    `);

    // The history reads one conversation newest first, with the id breaking a
    // shared millisecond — the same order the cursor pages through.
    await queryRunner.query(`
      CREATE INDEX "IDX_message_conversation"
        ON "message" ("conversation_id", "created_at" DESC, "id" DESC)
    `);

    // One picture belongs to one message. NULLs are distinct in PostgreSQL, so
    // this constrains the pictures and leaves the text-only messages alone.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_message_attachment"
        ON "message" ("attachment_id")
    `);

    // The one core table this phase widens (E40). A registration's file keeps
    // its owner and its field key; a message's picture has neither.
    await queryRunner.query(`
      ALTER TABLE "attachment"
        ALTER COLUMN "registration_id" DROP NOT NULL,
        ALTER COLUMN "field_key" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "attachment"
        -- Exactly one kind of ownership: either a registration asked for the
        -- file under a field key, or neither is set and a message points at it.
        ADD CONSTRAINT "CHK_attachment_owner" CHECK (
          ("registration_id" IS NULL) = ("field_key" IS NULL)
        ),
        -- And the two kinds live in two subtrees, which is the third layer of
        -- E19 after the route and the image service.
        ADD CONSTRAINT "CHK_attachment_area" CHECK (
          CASE WHEN "registration_id" IS NULL
            THEN "file_path" LIKE 'messages/%'
            ELSE "file_path" LIKE 'attachments/%'
          END
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "message"`);
    await queryRunner.query(`DROP TABLE "conversation_member"`);
    await queryRunner.query(`DROP TABLE "conversation"`);

    await queryRunner.query(`
      ALTER TABLE "attachment"
        DROP CONSTRAINT "CHK_attachment_area",
        DROP CONSTRAINT "CHK_attachment_owner"
    `);

    // The rows of the chat pictures go, because the column they hang off has to
    // be NOT NULL again. Their **files** stay in `messages/`: a migration has
    // no upload volume, and the honest thing is to say so rather than to
    // pretend a rollback cleaned up — the subtree is one `rm -r` for an
    // operator, and it is named after what it holds.
    await queryRunner.query(
      `DELETE FROM "attachment" WHERE "registration_id" IS NULL`,
    );

    await queryRunner.query(`
      ALTER TABLE "attachment"
        ALTER COLUMN "field_key" SET NOT NULL,
        ALTER COLUMN "registration_id" SET NOT NULL
    `);
  }
}
