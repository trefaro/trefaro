import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  ModuleConfigRecord,
  ModuleConfigRepository,
  ModuleDefault,
} from '../../business/config/ports/module-config.repository';
import { ModuleConfigEntity } from '../entities';

/** PostgreSQL implementation of {@link ModuleConfigRepository}. */
@Injectable()
export class TypeormModuleConfigRepository implements ModuleConfigRepository {
  constructor(
    @InjectRepository(ModuleConfigEntity)
    private readonly repository: Repository<ModuleConfigEntity>,
  ) {}

  async findAll(): Promise<readonly ModuleConfigRecord[]> {
    const rows = await this.repository.find({ order: { moduleKey: 'ASC' } });
    return rows.map(toRecord);
  }

  async ensureDefaults(defaults: readonly ModuleDefault[]): Promise<void> {
    if (defaults.length === 0) return;

    // `orIgnore` keeps a state the organization already chose: seeding defaults
    // at every boot must never switch a module back off.
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(ModuleConfigEntity)
      .values(
        defaults.map((entry) => ({
          moduleKey: entry.moduleKey,
          enabled: entry.enabled,
          settings: {},
        })),
      )
      .orIgnore()
      .execute();
  }

  async setEnabled(
    moduleKey: string,
    enabled: boolean,
  ): Promise<ModuleConfigRecord> {
    await this.repository.update({ moduleKey }, { enabled });
    const row = await this.repository.findOneBy({ moduleKey });
    if (!row) {
      throw new Error(`Unknown module "${moduleKey}"`);
    }
    return toRecord(row);
  }
}

function toRecord(row: ModuleConfigEntity): ModuleConfigRecord {
  return {
    moduleKey: row.moduleKey,
    enabled: row.enabled,
    settings: row.settings,
  };
}
