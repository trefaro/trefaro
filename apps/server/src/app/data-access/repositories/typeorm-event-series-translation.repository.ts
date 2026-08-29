import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EventSeriesTranslation } from '@trefaro/shared-models';
import { Repository } from 'typeorm';
import type { EventSeriesTranslationRepository } from '../../business/event-series/ports/event-series-translation.repository';
import { EventSeriesTranslationEntity } from '../entities';
import { TypeormContentTranslationRepository } from './typeorm-content-translation.repository';

/** What a series says in other languages, in PostgreSQL (FR 3.12). */
@Injectable()
export class TypeormEventSeriesTranslationRepository
  extends TypeormContentTranslationRepository<
    EventSeriesTranslationEntity,
    EventSeriesTranslation
  >
  implements EventSeriesTranslationRepository
{
  constructor(
    @InjectRepository(EventSeriesTranslationEntity)
    rows: Repository<EventSeriesTranslationEntity>,
  ) {
    super(rows, 'seriesId', ['name', 'description']);
  }
}
