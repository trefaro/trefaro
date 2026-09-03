import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  ConversationPurgeRepository,
  UnownedFile,
} from '../../business/attachments/ports/conversation-purge.repository';
import { ConversationEntity } from '../entities';

/**
 * The pictures inside a set of conversations, before they are deleted.
 *
 * Read first and by id, because after the conversations are gone nothing says
 * which files were theirs: `attachment` has no conversation column — a
 * message's picture is reached from the message (F37, E40) — and the pointer
 * that would have led back is exactly what the cascade removes.
 */
const IMAGES_OF = `
  SELECT a."id"        AS "id",
         a."file_path" AS "path"
    FROM "attachment" a
    JOIN "message" m ON m."attachment_id" = a."id"
   WHERE m."conversation_id" = ANY($1::uuid[])`;

/**
 * PostgreSQL implementation of {@link ConversationPurgeRepository} (F158).
 *
 * Three statements in one transaction, and the order is the whole point:
 *
 * 1. which conversations are affected, and which files hang in them;
 * 2. delete the conversations — the cascade takes their messages;
 * 3. delete those `attachment` rows, which nothing points at any more.
 *
 * The reverse fails: `FK_message_attachment` is `ON DELETE SET NULL`, so
 * removing an attachment first would leave a message with neither text nor
 * picture, which `CHK_message_content` refuses. The constraint is what makes
 * this order a rule rather than a preference.
 */
@Injectable()
export class TypeormConversationPurgeRepository implements ConversationPurgeRepository {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversations: Repository<ConversationEntity>,
  ) {}

  async purgeForEvent(eventId: string): Promise<readonly UnownedFile[]> {
    return this.purge(
      `SELECT "id" FROM "conversation" WHERE "event_id" = $1`,
      eventId,
    );
  }

  async purgeForSeries(seriesId: string): Promise<readonly UnownedFile[]> {
    return this.purge(
      `SELECT c."id"
         FROM "conversation" c
         JOIN "event" e ON e."id" = c."event_id"
        WHERE e."series_id" = $1`,
      seriesId,
    );
  }

  private async purge(
    idsQuery: string,
    parameter: string,
  ): Promise<readonly UnownedFile[]> {
    return this.conversations.manager.transaction(async (manager) => {
      const rows = await manager.query<readonly { id: string }[]>(idsQuery, [
        parameter,
      ]);
      const ids = rows.map((row) => row.id);
      if (ids.length === 0) return [];

      const files = await manager.query<readonly UnownedFile[]>(IMAGES_OF, [
        ids,
      ]);

      // The cascade takes their messages with them.
      await manager.query(
        `DELETE FROM "conversation" WHERE "id" = ANY($1::uuid[])`,
        [ids],
      );
      if (files.length > 0) {
        await manager.query(
          `DELETE FROM "attachment" WHERE "id" = ANY($1::uuid[])`,
          [files.map((file) => file.id)],
        );
      }

      return files;
    });
  }
}
