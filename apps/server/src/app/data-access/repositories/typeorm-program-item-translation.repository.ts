import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ProgramItemTranslation } from '@trefaro/shared-models';
import { Repository } from 'typeorm';
import type { ProgramItemTranslationRepository } from '../../business/program/ports/program-item-translation.repository';
import { ProgramItemTranslationEntity } from '../entities';
import { TypeormContentTranslationRepository } from './typeorm-content-translation.repository';

/** What a session says in other languages, in PostgreSQL (FR 3.12). */
@Injectable()
export class TypeormProgramItemTranslationRepository
  extends TypeormContentTranslationRepository<
    ProgramItemTranslationEntity,
    ProgramItemTranslation
  >
  implements ProgramItemTranslationRepository
{
  constructor(
    @InjectRepository(ProgramItemTranslationEntity)
    rows: Repository<ProgramItemTranslationEntity>,
  ) {
    super(rows, 'programItemId', ['title', 'description']);
  }
}
