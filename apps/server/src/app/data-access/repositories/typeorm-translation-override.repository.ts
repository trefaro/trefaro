import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  TranslationOverrideReader,
  TranslationOverrideRecord,
} from '../../business/i18n/ports/translation-override.repository';
import { TranslationOverrideEntity } from '../entities';

/**
 * The instance's own translations, in PostgreSQL (E22).
 *
 * Ordered by key so two reads of the same language produce the same JSON — the
 * catalogue's ETag is a hash of what is served, and an unordered read would
 * change it without any translation changing.
 */
@Injectable()
export class TypeormTranslationOverrideRepository implements TranslationOverrideReader {
  constructor(
    @InjectRepository(TranslationOverrideEntity)
    private readonly overrides: Repository<TranslationOverrideEntity>,
  ) {}

  async findByLocale(
    locale: string,
  ): Promise<readonly TranslationOverrideRecord[]> {
    return this.overrides.find({
      where: { locale },
      order: { key: 'ASC' },
    });
  }

  async localesWithOverrides(): Promise<readonly string[]> {
    const rows = await this.overrides
      .createQueryBuilder('override')
      .select('DISTINCT override.locale', 'locale')
      .orderBy('locale', 'ASC')
      .getRawMany<{ locale: string }>();

    return rows.map((row) => row.locale);
  }
}
