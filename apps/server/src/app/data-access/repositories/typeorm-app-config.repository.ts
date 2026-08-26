import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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

    return {
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      logoPath: row.logoPath,
      fontFamily: row.fontFamily,
      defaultLocale: row.defaultLocale,
      availableLocales: row.activeLocales,
    };
  }
}
