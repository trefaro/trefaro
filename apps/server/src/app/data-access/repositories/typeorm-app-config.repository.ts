import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  AppConfigChange,
  BrandingImageKind,
} from '@trefaro/shared-models';
import { Repository } from 'typeorm';
import type {
  AppConfigRecord,
  AppConfigRepository,
} from '../../business/config/ports/app-config.repository';
import { APP_CONFIG_SINGLETON_ID, AppConfigEntity } from '../entities';

/**
 * PostgreSQL implementation of {@link AppConfigRepository}.
 *
 * Maps the entity onto the business-layer record so no ORM type crosses the
 * layer boundary.
 */
@Injectable()
export class TypeormAppConfigRepository implements AppConfigRepository {
  constructor(
    @InjectRepository(AppConfigEntity)
    private readonly repository: Repository<AppConfigEntity>,
  ) {}

  async load(): Promise<AppConfigRecord> {
    return this.toRecord(await this.findRow());
  }

  async save(change: AppConfigChange): Promise<AppConfigRecord> {
    const row = await this.findRow();

    // Only the keys that were sent, so a `PATCH` cannot blank a value by
    // omitting it. `undefined` is "not mentioned"; none of these columns is
    // nullable, so there is no third state to express.
    if (change.organizationName !== undefined) {
      row.organizationName = change.organizationName;
    }
    if (change.primaryColor !== undefined) {
      row.primaryColor = change.primaryColor;
    }
    if (change.accentColor !== undefined) {
      row.accentColor = change.accentColor;
    }
    if (change.fontFamily !== undefined) {
      row.fontFamily = change.fontFamily;
    }

    return this.toRecord(await this.repository.save(row));
  }

  async setBrandingImage(
    kind: BrandingImageKind,
    storedPath: string | null,
  ): Promise<AppConfigRecord> {
    const row = await this.findRow();

    // The one place that knows which column carries which image. A `switch`
    // rather than a lookup table, so adding a third kind does not compile until
    // this decision has been made for it.
    switch (kind) {
      case 'logo':
        row.logoPath = storedPath;
        break;
      case 'app-icon':
        row.appIconPath = storedPath;
        break;
    }

    return this.toRecord(await this.repository.save(row));
  }

  private async findRow(): Promise<AppConfigEntity> {
    const row = await this.repository.findOneBy({
      id: APP_CONFIG_SINGLETON_ID,
    });

    // The initial migration seeds this row, so a missing one means the database
    // was tampered with or a migration was skipped. Failing loudly beats serving
    // a silently invented theme.
    if (!row) {
      throw new Error(
        'app_config row is missing — run the database migrations before starting the server',
      );
    }

    return row;
  }

  private toRecord(row: AppConfigEntity): AppConfigRecord {
    return {
      organizationName: row.organizationName,
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      logoPath: row.logoPath,
      appIconPath: row.appIconPath,
      fontFamily: row.fontFamily,
      defaultLocale: row.defaultLocale,
      availableLocales: row.activeLocales,
      updatedAt: row.updatedAt,
    };
  }
}
