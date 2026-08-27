import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { MediaLinkSummary } from '@trefaro/shared-models';
import { Repository } from 'typeorm';
import type { MediaLinkTally } from '../../business/media-links/ports/media-link-tally';
import type {
  MediaLinkChanges,
  MediaLinkRecord,
  MediaLinkRepository,
  NewMediaLink,
} from '../../business/media-links/ports/media-link.repository';
import { MediaLinkEntity } from '../entities';

/**
 * PostgreSQL implementation of the media links port (FR 3.6, F10).
 *
 * Also implements {@link MediaLinkTally}, the narrow counting port the dashboard
 * uses (FR 3.8) — one class, two ports, the same arrangement the registration
 * and programme repositories have with their tallies.
 */
@Injectable()
export class TypeormMediaLinkRepository
  implements MediaLinkRepository, MediaLinkTally
{
  constructor(
    @InjectRepository(MediaLinkEntity)
    private readonly repository: Repository<MediaLinkEntity>,
  ) {}

  async findByEvent(eventId: string): Promise<readonly MediaLinkRecord[]> {
    const rows = await this.repository.find({
      where: { eventId },
      // Oldest first, with the id breaking a tie the same way it does in every
      // other list here. The kind's order is applied above this layer, where the
      // list of kinds lives (F52).
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map(toRecord);
  }

  async countForEvent(eventId: string): Promise<MediaLinkSummary> {
    // One aggregate rather than the links themselves: the dashboard tile says
    // how much there is, and four numbers are cheaper than every URL of a
    // three-day conference.
    const counts = await this.repository
      .createQueryBuilder('link')
      .select('COUNT(*)::int', 'links')
      .addSelect("COUNT(*) FILTER (WHERE link.kind = 'stream')::int", 'streams')
      .addSelect(
        "COUNT(*) FILTER (WHERE link.kind = 'recording')::int",
        'recordings',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE link.kind = 'material')::int",
        'materials',
      )
      .where('link.event_id = :eventId', { eventId })
      .getRawOne<MediaLinkSummary>();

    return {
      links: Number(counts?.links ?? 0),
      streams: Number(counts?.streams ?? 0),
      recordings: Number(counts?.recordings ?? 0),
      materials: Number(counts?.materials ?? 0),
    };
  }

  async findById(id: string): Promise<MediaLinkRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async create(link: NewMediaLink): Promise<MediaLinkRecord> {
    return toRecord(
      await this.repository.save(this.repository.create({ ...link })),
    );
  }

  async update(
    id: string,
    changes: MediaLinkChanges,
  ): Promise<MediaLinkRecord | null> {
    const result = await this.repository.update({ id }, { ...changes });
    if ((result.affected ?? 0) === 0) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}

function toRecord(row: MediaLinkEntity): MediaLinkRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    programItemId: row.programItemId,
    kind: row.kind,
    title: row.title,
    url: row.url,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
