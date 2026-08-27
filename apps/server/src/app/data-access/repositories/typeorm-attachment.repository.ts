import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  AttachmentRecord,
  AttachmentRepository,
  NewAttachment,
} from '../../business/attachments/ports/attachment.repository';
import { AttachmentEntity } from '../entities';

/**
 * PostgreSQL implementation of the attachment port (E9).
 *
 * Two shapes of query are worth explaining:
 *
 * - **Every delete uses `RETURNING`.** The caller needs the paths of the rows it
 *   just removed in order to unlink the files, and reading them first would be
 *   a second statement another request could interleave with.
 * - **A registration's files come back in form order.** The order lives in
 *   `registration_field_def`, joined by event and key — the same pairing the
 *   answers use. Left-joined, because a field can be deleted while its answers
 *   stay (F34); those files sort last rather than disappearing.
 */
@Injectable()
export class TypeormAttachmentRepository implements AttachmentRepository {
  constructor(
    @InjectRepository(AttachmentEntity)
    private readonly repository: Repository<AttachmentEntity>,
  ) {}

  async findById(id: string): Promise<AttachmentRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async findByRegistration(
    registrationId: string,
  ): Promise<readonly AttachmentRecord[]> {
    const rows: readonly AttachmentEntity[] = await this.repository
      .createQueryBuilder('attachment')
      .innerJoin(
        'registration',
        'registration',
        'registration.id = attachment.registration_id',
      )
      .leftJoin(
        'registration_field_def',
        'field',
        'field.event_id = registration.event_id AND field.key = attachment.field_key',
      )
      .where('attachment.registration_id = :registrationId', { registrationId })
      .orderBy('field.sort', 'ASC', 'NULLS LAST')
      // The key breaks a tie, so two reads never disagree about the order.
      .addOrderBy('attachment.field_key', 'ASC')
      .getMany();
    return rows.map(toRecord);
  }

  async create(attachment: NewAttachment): Promise<AttachmentRecord> {
    return toRecord(
      await this.repository.save(this.repository.create({ ...attachment })),
    );
  }

  async deleteByIds(
    ids: readonly string[],
  ): Promise<readonly AttachmentRecord[]> {
    if (ids.length === 0) return [];
    return this.removeWhere('id IN (:...ids)', { ids: [...ids] });
  }

  async deleteByRegistration(
    registrationId: string,
  ): Promise<readonly AttachmentRecord[]> {
    return this.removeWhere('registration_id = :registrationId', {
      registrationId,
    });
  }

  async deleteByEvent(eventId: string): Promise<readonly AttachmentRecord[]> {
    return this.removeWhere(
      `registration_id IN (
         SELECT "id" FROM "registration" WHERE "event_id" = :eventId
       )`,
      { eventId },
    );
  }

  async deleteBySeries(seriesId: string): Promise<readonly AttachmentRecord[]> {
    return this.removeWhere(
      `registration_id IN (
         SELECT "registration"."id"
         FROM "registration"
         JOIN "event" ON "event"."id" = "registration"."event_id"
         WHERE "event"."series_id" = :seriesId
       )`,
      { seriesId },
    );
  }

  /** One statement: delete and report what was deleted. */
  private async removeWhere(
    condition: string,
    parameters: Record<string, unknown>,
  ): Promise<readonly AttachmentRecord[]> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(AttachmentEntity)
      .where(condition, parameters)
      .returning('*')
      .execute();
    return (result.raw as readonly RawAttachment[]).map(fromRaw);
  }
}

/** `RETURNING *` answers with column names, not with entity properties. */
interface RawAttachment {
  readonly id: string;
  readonly registration_id: string;
  readonly field_key: string;
  readonly file_path: string;
  readonly file_name: string;
  readonly mime_type: string;
  readonly size_bytes: number;
  readonly created_at: Date;
}

function fromRaw(row: RawAttachment): AttachmentRecord {
  return {
    id: row.id,
    registrationId: row.registration_id,
    fieldKey: row.field_key,
    path: row.file_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at,
  };
}

function toRecord(row: AttachmentEntity): AttachmentRecord {
  return {
    id: row.id,
    registrationId: row.registrationId,
    fieldKey: row.fieldKey,
    path: row.path,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
  };
}
