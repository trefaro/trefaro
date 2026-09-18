import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import type {
  ErasureRecord,
  ExportedConversation,
  ExportedMessage,
  ExportedNewsletterSubscription,
  ExportedProfile,
  ExportedProgramSignup,
  ExportedPushSubscription,
  ExportedRegistration,
  ExportedSession,
  ParticipantDataRecord,
  ParticipantDataRepository,
} from '../../business/privacy/ports/participant-data.repository';
import { UserProfileEntity } from '../entities';

/**
 * PostgreSQL implementation of {@link ParticipantDataRepository} (E65).
 *
 * **Every table that knows this person is named in this one file**, and that is
 * the property the whole package rests on. There are three ways a row can point
 * at somebody here, and each is read and erased differently:
 *
 * 1. **A foreign key on `user_profile`** — `user_session`, `push_subscription`,
 *    and in the plug-ins `plugin_forum_post`, `plugin_forum_thread`,
 *    `plugin_program_proposals_proposal`, `plugin_personal_program_entry`. One
 *    `DELETE` of the profile row handles all six, and each of those tables
 *    decides for itself what that means: the posts and the plan cascade, the
 *    thread is set to `NULL` because it holds other people's replies (AP 6's
 *    plug-in migration). The core never names a plug-in table in SQL — F21 read
 *    in the other direction.
 * 2. **The address**, which is the identity (E31) — `registration` and
 *    `newsletter_subscription`. Matched case-insensitively, like every other
 *    address lookup. Deleting a registration cascades into `attachment`,
 *    `program_item_signup`, `invitation_recipient` and
 *    `plugin_qr_checkin_ticket`.
 * 3. **A column with no foreign key at all** — `conversation_member.member_id`
 *    and `message.sender_id`, the one deliberate gap in this schema (E39).
 *    Nothing removes those for us, so they are the two statements this class
 *    writes by hand, and they are written in opposite directions: the
 *    membership goes, because it says this person is in a conversation; the
 *    message stays, because somebody else read it.
 */
@Injectable()
export class TypeormParticipantDataRepository implements ParticipantDataRepository {
  constructor(
    @InjectRepository(UserProfileEntity)
    private readonly profiles: Repository<UserProfileEntity>,
  ) {}

  async collect(profileId: string): Promise<ParticipantDataRecord | null> {
    const manager = this.profiles.manager;
    const profile = await this.profileOf(manager, profileId);
    if (!profile) return null;

    const [
      sessions,
      pushSubscriptions,
      registrations,
      programSignups,
      newsletterSubscriptions,
      conversations,
    ] = await Promise.all([
      this.sessionsOf(manager, profileId),
      this.pushSubscriptionsOf(manager, profileId),
      this.registrationsOf(manager, profile.email),
      this.programSignupsOf(manager, profile.email),
      this.newsletterOf(manager, profile.email),
      this.conversationsOf(manager, profileId),
    ]);

    return {
      profile,
      sessions,
      pushSubscriptions,
      registrations,
      programSignups,
      newsletterSubscriptions,
      conversations,
    };
  }

  async erase(profileId: string): Promise<ErasureRecord> {
    return this.profiles.manager.transaction(async (manager) => {
      const rows = await manager.query<
        readonly { email: string; path: string | null }[]
      >(
        `SELECT "email", "avatar_path" AS "path"
           FROM "user_profile" WHERE "id" = $1`,
        [profileId],
      );
      const profile = rows[0];
      if (!profile) {
        return {
          files: [],
          registrationsRemoved: 0,
          conversationsLeftStanding: 0,
          newsletterSubscriptionsRemoved: 0,
        };
      }

      // Read before deleting: after the cascade nothing says which files were
      // this person's, the same rule every other purge in this application
      // follows (F158).
      const attachments = await manager.query<readonly { path: string }[]>(
        `SELECT a."file_path" AS "path"
           FROM "attachment" a
           JOIN "registration" r ON r."id" = a."registration_id"
          WHERE lower(r."email") = lower($1)`,
        [profile.email],
      );

      // The memberships have no foreign key to remove them (E39). Counted
      // first, because after the delete there is nothing to count.
      const standing = deleted<{ id: string }>(
        await manager.query(
          `DELETE FROM "conversation_member"
            WHERE "member_type" = 'user' AND "member_id" = $1
            RETURNING "conversation_id" AS "id"`,
          [profileId],
        ),
      );

      // A one-to-one conversation both of whose members have erased their
      // accounts is unreachable: two people's messages behind a row nobody can
      // open. It goes, and its pictures with it — in this order, because
      // `FK_message_attachment` is `ON DELETE SET NULL` and an attachment
      // removed first would leave a message with neither text nor picture,
      // which `CHK_message_content` refuses (F158).
      const emptied = await manager.query<readonly { id: string }[]>(
        `SELECT c."id"
           FROM "conversation" c
          WHERE c."type" = 'direct'
            AND c."id" = ANY($1::uuid[])
            AND NOT EXISTS (
              SELECT 1 FROM "conversation_member" m
               WHERE m."conversation_id" = c."id"
            )`,
        [standing.map((row) => row.id)],
      );
      const emptiedIds = emptied.map((row) => row.id);
      const orphanedPictures =
        emptiedIds.length === 0
          ? []
          : await manager.query<readonly { path: string }[]>(
              `SELECT a."file_path" AS "path"
                 FROM "attachment" a
                 JOIN "message" m ON m."attachment_id" = a."id"
                WHERE m."conversation_id" = ANY($1::uuid[])`,
              [emptiedIds],
            );
      if (emptiedIds.length > 0) {
        await manager.query(
          `DELETE FROM "conversation" WHERE "id" = ANY($1::uuid[])`,
          [emptiedIds],
        );
        await manager.query(
          `DELETE FROM "attachment"
            WHERE "file_path" = ANY($1::text[]) AND "registration_id" IS NULL`,
          [orphanedPictures.map((row) => row.path)],
        );
      }

      const consents = deleted(
        await manager.query(
          `DELETE FROM "newsletter_subscription"
            WHERE lower("email") = lower($1) RETURNING "id"`,
          [profile.email],
        ),
      );

      // Found by address, because that is what ties a registration to an
      // account (E31). The cascade takes the files' rows, the seats at
      // programme items, the invitation lines and the check-in tickets.
      const registrations = deleted(
        await manager.query(
          `DELETE FROM "registration" WHERE lower("email") = lower($1)
            RETURNING "id"`,
          [profile.email],
        ),
      );

      // Last, and the one statement that reaches the plug-ins: every table
      // with a foreign key on `user_profile` decides here what it does.
      await manager.query(`DELETE FROM "user_profile" WHERE "id" = $1`, [
        profileId,
      ]);

      return {
        files: [
          ...(profile.path ? [profile.path] : []),
          ...attachments.map((row) => row.path),
          ...orphanedPictures.map((row) => row.path),
        ],
        registrationsRemoved: registrations.length,
        conversationsLeftStanding: standing.length - emptiedIds.length,
        newsletterSubscriptionsRemoved: consents.length,
      };
    });
  }

  private async profileOf(
    manager: EntityManager,
    id: string,
  ): Promise<ExportedProfile | null> {
    const rows = await manager.query<readonly ExportedProfile[]>(
      `SELECT "id",
              "email",
              "first_name"        AS "firstName",
              "last_name"         AS "lastName",
              "preferred_locale"  AS "preferredLocale",
              "activity_areas"    AS "activityAreas",
              "custom_fields_json" AS "customFields",
              "searchable",
              "avatar_path"       AS "avatarPath",
              "confirmed_at"      AS "confirmedAt",
              "created_at"        AS "createdAt",
              "updated_at"        AS "updatedAt"
         FROM "user_profile" WHERE "id" = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  private sessionsOf(
    manager: EntityManager,
    id: string,
  ): Promise<readonly ExportedSession[]> {
    // No token hash: a session is a credential, and an archive is a copy that
    // leaves the instance.
    return manager.query(
      `SELECT "created_at"   AS "createdAt",
              "last_seen_at" AS "lastSeenAt",
              "expires_at"   AS "expiresAt"
         FROM "user_session" WHERE "user_id" = $1
        ORDER BY "created_at"`,
      [id],
    );
  }

  private pushSubscriptionsOf(
    manager: EntityManager,
    id: string,
  ): Promise<readonly ExportedPushSubscription[]> {
    // Endpoint and keys stay out for the same reason: they are what a browser
    // is written to with, not something about a person.
    return manager.query(
      `SELECT "user_agent" AS "userAgent", "created_at" AS "createdAt"
         FROM "push_subscription" WHERE "user_id" = $1
        ORDER BY "created_at"`,
      [id],
    );
  }

  private async registrationsOf(
    manager: EntityManager,
    email: string,
  ): Promise<readonly ExportedRegistration[]> {
    // Titles in the language the rows were written in, not a translation: an
    // export is data, and `?locale=` is a property of a screen (F95).
    const rows = await manager.query<
      readonly Omit<ExportedRegistration, 'files'>[]
    >(
      `SELECT r."id",
              e."name"       AS "eventTitle",
              e."slug"       AS "eventSlug",
              s."name"       AS "seriesTitle",
              s."slug"       AS "seriesSlug",
              e."starts_at"  AS "eventStartsAt",
              r."email",
              r."first_name" AS "firstName",
              r."last_name"  AS "lastName",
              r."phone",
              r."origin",
              r."custom_fields_json" AS "customFields",
              r."status",
              r."newsletter_opt_in"  AS "newsletterOptIn",
              r."contact_opt_out"    AS "contactOptOut",
              r."confirmed_at"       AS "confirmedAt",
              r."created_at"         AS "createdAt"
         FROM "registration" r
         JOIN "event" e ON e."id" = r."event_id"
         JOIN "event_series" s ON s."id" = e."series_id"
        WHERE lower(r."email") = lower($1)
        ORDER BY r."created_at"`,
      [email],
    );
    if (rows.length === 0) return [];

    const files = await manager.query<
      readonly {
        registrationId: string;
        path: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        fieldKey: string;
      }[]
    >(
      `SELECT "registration_id" AS "registrationId",
              "file_path"       AS "path",
              "file_name"       AS "fileName",
              "mime_type"       AS "mimeType",
              "size_bytes"      AS "sizeBytes",
              "field_key"       AS "fieldKey"
         FROM "attachment"
        WHERE "registration_id" = ANY($1::uuid[])
        ORDER BY "created_at"`,
      [rows.map((row) => row.id)],
    );

    return rows.map((row) => ({
      ...row,
      files: files
        .filter((file) => file.registrationId === row.id)
        .map(({ registrationId: _ignored, ...file }) => file),
    }));
  }

  private programSignupsOf(
    manager: EntityManager,
    email: string,
  ): Promise<readonly ExportedProgramSignup[]> {
    return manager.query(
      `SELECT e."name"      AS "eventTitle",
              i."title"     AS "itemTitle",
              i."starts_at" AS "startsAt",
              g."created_at" AS "createdAt"
         FROM "program_item_signup" g
         JOIN "program_item" i ON i."id" = g."program_item_id"
         JOIN "event" e ON e."id" = i."event_id"
         JOIN "registration" r ON r."id" = g."registration_id"
        WHERE lower(r."email") = lower($1)
        ORDER BY i."starts_at"`,
      [email],
    );
  }

  private newsletterOf(
    manager: EntityManager,
    email: string,
  ): Promise<readonly ExportedNewsletterSubscription[]> {
    return manager.query(
      `SELECT n."email",
              s."name"         AS "seriesTitle",
              n."confirmed_at" AS "confirmedAt",
              n."created_at"   AS "createdAt"
         FROM "newsletter_subscription" n
         LEFT JOIN "event_series" s ON s."id" = n."event_series_id"
        WHERE lower(n."email") = lower($1)
        ORDER BY n."created_at"`,
      [email],
    );
  }

  private async conversationsOf(
    manager: EntityManager,
    id: string,
  ): Promise<readonly ExportedConversation[]> {
    const rows = await manager.query<
      readonly {
        id: string;
        type: string;
        topic: string | null;
        joinedAt: Date;
      }[]
    >(
      `SELECT c."id", c."type", c."topic", m."joined_at" AS "joinedAt"
         FROM "conversation" c
         JOIN "conversation_member" m ON m."conversation_id" = c."id"
        WHERE m."member_type" = 'user' AND m."member_id" = $1
        ORDER BY c."created_at"`,
      [id],
    );
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const [counterparts, messages] = await Promise.all([
      manager.query<readonly { conversationId: string; name: string }[]>(
        // Whoever else is in it, by name. An erased member is simply not in
        // this answer any more, which is what "names nobody" means here.
        `SELECT m."conversation_id" AS "conversationId",
                btrim(p."first_name" || ' ' || p."last_name") AS "name"
           FROM "conversation_member" m
           JOIN "user_profile" p ON p."id" = m."member_id"
          WHERE m."conversation_id" = ANY($1::uuid[])
            AND m."member_type" = 'user'
            AND m."member_id" <> $2
          ORDER BY "name"`,
        [ids, id],
      ),
      manager.query<
        readonly {
          conversationId: string;
          id: string;
          senderId: string | null;
          body: string | null;
          sentAt: Date;
          path: string | null;
          fileName: string | null;
          mimeType: string | null;
          sizeBytes: number | null;
        }[]
      >(
        `SELECT m."conversation_id" AS "conversationId",
                m."id",
                m."sender_id"  AS "senderId",
                m."body",
                m."created_at" AS "sentAt",
                a."file_path"  AS "path",
                a."file_name"  AS "fileName",
                a."mime_type"  AS "mimeType",
                a."size_bytes" AS "sizeBytes"
           FROM "message" m
           LEFT JOIN "attachment" a ON a."id" = m."attachment_id"
          WHERE m."conversation_id" = ANY($1::uuid[])
          ORDER BY m."created_at", m."id"`,
        [ids],
      ),
    ]);

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      topic: row.topic,
      counterparts: counterparts
        .filter((one) => one.conversationId === row.id)
        .map((one) => one.name),
      joinedAt: row.joinedAt,
      messages: messages
        .filter((message) => message.conversationId === row.id)
        .map<ExportedMessage>((message) => ({
          id: message.id,
          mine: message.senderId === id,
          body: message.body,
          file:
            message.path === null
              ? null
              : {
                  path: message.path,
                  fileName: message.fileName ?? '',
                  mimeType: message.mimeType ?? '',
                  sizeBytes: message.sizeBytes ?? 0,
                  fieldKey: null,
                },
          sentAt: message.sentAt,
        })),
    }));
  }
}

/**
 * The rows a `DELETE … RETURNING` removed.
 *
 * TypeORM's PostgreSQL driver answers a `DELETE` or an `UPDATE` with
 * `[rows, rowCount]` rather than with the rows — a shape no `SELECT` has, and
 * one that is easy to read straight past: `result.length` is then always 2, so
 * three counts in a log line came out as "2" three times and a list of ids came
 * out as two `undefined`. Unwrapped here, once, rather than at three call sites.
 */
function deleted<T>(result: unknown): readonly T[] {
  return Array.isArray(result) && Array.isArray(result[0])
    ? (result[0] as readonly T[])
    : [];
}
