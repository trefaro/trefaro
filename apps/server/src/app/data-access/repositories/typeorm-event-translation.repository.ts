import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EventTranslation } from '@trefaro/shared-models';
import { Repository } from 'typeorm';
import type { EventTranslationRepository } from '../../business/events/ports/event-translation.repository';
import { EventTranslationEntity } from '../entities';
import { TypeormContentTranslationRepository } from './typeorm-content-translation.repository';

/** What an event says in other languages, in PostgreSQL (FR 3.12). */
@Injectable()
export class TypeormEventTranslationRepository
  extends TypeormContentTranslationRepository<
    EventTranslationEntity,
    EventTranslation
  >
  implements EventTranslationRepository
{
  constructor(
    @InjectRepository(EventTranslationEntity)
    rows: Repository<EventTranslationEntity>,
  ) {
    super(rows, 'eventId', [
      'name',
      'description',
      'venueName',
      'followUpBody',
    ]);
  }
}
