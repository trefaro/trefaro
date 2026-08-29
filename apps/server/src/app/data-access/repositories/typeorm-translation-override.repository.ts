import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type {
  TranslationOverrideChange,
  TranslationOverrideRecord,
  TranslationOverrideRepository,
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
export class TypeormTranslationOverrideRepository implements TranslationOverrideRepository {
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

  /**
   * Applies one language's changes in a single transaction.
   *
   * The write is an `ON CONFLICT` upsert on the composite primary key rather
   * than a read-then-decide: whether a row exists is exactly what the key
   * already answers, and asking first would make an import a query per key.
   * `updated_at` is set explicitly, because the column's default only applies to
   * an insert and the value's whole purpose is "when did this text last change".
   */
  async apply(change: TranslationOverrideChange): Promise<void> {
    if (change.write.length === 0 && change.remove.length === 0) return;

    await this.overrides.manager.transaction(async (manager) => {
      const rows = manager.getRepository(TranslationOverrideEntity);

      if (change.write.length > 0) {
        await rows
          .createQueryBuilder()
          .insert()
          .values(
            change.write.map((entry) => ({
              locale: change.locale,
              key: entry.key,
              value: entry.value,
              updatedAt: new Date(),
            })),
          )
          .orUpdate(['value', 'updated_at'], ['locale', 'key'])
          .execute();
      }

      if (change.remove.length > 0) {
        await rows.delete({ locale: change.locale, key: In(change.remove) });
      }
    });
  }
}
