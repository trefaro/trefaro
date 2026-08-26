import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * The instance's whitelabel configuration (FR 1.4).
 *
 * A single row: one instance serves exactly one organization (no multi-tenancy,
 * a privacy decision of the thesis). The primary key is pinned to
 * {@link APP_CONFIG_SINGLETON_ID} by a check constraint in the migration, so a
 * second configuration cannot be inserted by accident.
 */
export const APP_CONFIG_SINGLETON_ID = 1;

@Entity({ name: 'app_config' })
export class AppConfigEntity {
  @PrimaryColumn({ type: 'smallint' })
  id!: number;

  @Column({ name: 'primary_color', type: 'varchar', length: 32 })
  primaryColor!: string;

  @Column({ name: 'accent_color', type: 'varchar', length: 32 })
  accentColor!: string;

  /** Storage-relative path inside the upload volume, never an external URL. */
  @Column({ name: 'logo_path', type: 'varchar', length: 512, nullable: true })
  logoPath!: string | null;

  @Column({ name: 'font_family', type: 'varchar', length: 256 })
  fontFamily!: string;

  @Column({ name: 'default_locale', type: 'varchar', length: 16 })
  defaultLocale!: string;

  /**
   * BCP 47 tags the organization maintains translations for. Stored as an array
   * so organizations can add a language without a schema change.
   */
  @Column({ name: 'active_locales', type: 'varchar', length: 16, array: true })
  activeLocales!: string[];

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
