import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * One translation an organization changed or added (E22).
 *
 * The composite primary key `(locale, key)` is the natural one and the only one:
 * a translation is identified by which language it is in and what it translates,
 * so a surrogate id would be a second thing to keep unique.
 */
@Entity({ name: 'translation_override' })
export class TranslationOverrideEntity {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  locale!: string;

  @PrimaryColumn({ type: 'varchar', length: 200 })
  key!: string;

  @Column({ type: 'text' })
  value!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
