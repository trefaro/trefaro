import {
  In,
  type FindOptionsOrder,
  type FindOptionsWhere,
  type ObjectLiteral,
  type Repository,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import type {
  ContentTranslationRecord,
  ContentTranslationRepository,
} from '../../business/common/ports/content-translation.port';

/**
 * Content translations in PostgreSQL, once for all three tables (FR 3.12).
 *
 * The three tables differ in their parent column and in which texts they hold;
 * every statement over them is the same. Written once, so a change to how a
 * translation is stored — the upsert, the ordering, the empty-list guard — is
 * one change rather than three that can drift apart.
 *
 * Each concrete repository names its own entity, its own parent column and its
 * own fields, and inherits the rest. That is the whole of the difference.
 */
export abstract class TypeormContentTranslationRepository<
  Row extends ObjectLiteral,
  T,
> implements ContentTranslationRepository<T> {
  protected constructor(
    private readonly rows: Repository<Row>,
    /** The entity property holding the parent id — `eventId`, `seriesId`, … */
    private readonly parentKey: string & keyof Row,
    /** The stored text fields, as the payload names them. */
    private readonly fields: readonly (string & keyof Row)[],
  ) {}

  async findForParents(
    parentIds: readonly string[],
    locale: string,
  ): Promise<ReadonlyMap<string, T>> {
    // `In([])` becomes `IN ()`, which PostgreSQL refuses — and an empty list is
    // the ordinary case on a fresh instance, so it never reaches the database.
    if (parentIds.length === 0) return new Map();

    const found = await this.rows.find({
      where: {
        [this.parentKey]: In([...parentIds]),
        locale,
      } as unknown as FindOptionsWhere<Row>,
    });

    return new Map(
      found.map((row) => [String(row[this.parentKey]), this.toValue(row)]),
    );
  }

  async findAllForParent(
    parentId: string,
  ): Promise<readonly ContentTranslationRecord<T>[]> {
    return (await this.findAllForParents([parentId])).get(parentId) ?? [];
  }

  async findAllForParents(
    parentIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly ContentTranslationRecord<T>[]>> {
    if (parentIds.length === 0) return new Map();

    const found = await this.rows.find({
      where: {
        [this.parentKey]: In([...parentIds]),
      } as unknown as FindOptionsWhere<Row>,
      // By language, so the organizer's tabs come back in the same order twice
      // running — nothing downstream sorts them again.
      order: { locale: 'ASC' } as unknown as FindOptionsOrder<Row>,
    });

    const byParent = new Map<string, ContentTranslationRecord<T>[]>();
    for (const row of found) {
      const parent = String(row[this.parentKey]);
      const list = byParent.get(parent) ?? [];
      list.push({ locale: String(row['locale']), value: this.toValue(row) });
      byParent.set(parent, list);
    }
    return byParent;
  }

  /**
   * Writes one language of one parent, replacing what was there.
   *
   * An `ON CONFLICT` upsert on the composite primary key rather than a
   * read-then-decide: whether a row exists is what the key already answers.
   * `updated_at` is set explicitly, because the column default only fires on an
   * insert and this value exists to say when the text last changed.
   *
   * A field the payload does not carry is written as `NULL`, not left alone: the
   * screen sends the whole translation of one thing, so a missing field is a box
   * the translator cleared. Merging here would make an emptied box impossible to
   * express.
   */
  async save(parentId: string, locale: string, value: T): Promise<void> {
    const texts = value as Record<string, unknown>;
    const row: Record<string, unknown> = {
      [this.parentKey]: parentId,
      locale,
      updatedAt: new Date(),
    };
    for (const field of this.fields) row[field] = texts[field] ?? null;

    await this.rows
      .createQueryBuilder()
      .insert()
      .values(row as QueryDeepPartialEntity<Row>)
      .orUpdate(
        [...this.fields.map((field) => this.columnName(field)), 'updated_at'],
        [this.columnName(this.parentKey), 'locale'],
      )
      .execute();
  }

  async remove(parentId: string, locale: string): Promise<boolean> {
    const result = await this.rows.delete({
      [this.parentKey]: parentId,
      locale,
    } as unknown as FindOptionsWhere<Row>);
    return (result.affected ?? 0) > 0;
  }

  private toValue(row: Row): T {
    return Object.fromEntries(
      this.fields.map((field) => [field, row[field] ?? null]),
    ) as T;
  }

  /** The database name of a property — `orUpdate` names columns, not fields. */
  private columnName(property: string & keyof Row): string {
    const column = this.rows.metadata.findColumnWithPropertyName(property);
    if (!column) {
      throw new Error(
        `${this.rows.metadata.tableName} has no column for "${property}"`,
      );
    }
    return column.databaseName;
  }
}
