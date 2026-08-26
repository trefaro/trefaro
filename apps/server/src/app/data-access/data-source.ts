import type { DataSourceOptions } from 'typeorm';
import type { TrefaroEnv } from '../core/config/env';
import { CORE_ENTITIES } from './entities';
import { CORE_MIGRATIONS } from './migrations';
import type { CollectedPluginPersistence } from './plugin-data-access/plugin-persistence.registry';

/**
 * Builds the PostgreSQL data source.
 *
 * The only place in the server that names a database product. Swapping
 * PostgreSQL for something else means replacing this file and the repository
 * implementations next to it — nothing in the business layer.
 */
export function buildDataSourceOptions(
  env: TrefaroEnv,
  plugins: CollectedPluginPersistence = { entities: [], migrations: [] },
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.database.host,
    port: env.database.port,
    username: env.database.user,
    password: env.database.password,
    database: env.database.name,
    ssl: env.database.ssl ? { rejectUnauthorized: true } : false,

    // Core tables and plug-in tables live in one database but are declared
    // separately: a plug-in owns its own entities and migrations and never
    // touches core tables.
    entities: [...CORE_ENTITIES, ...plugins.entities],
    migrations: [...CORE_MIGRATIONS, ...plugins.migrations],

    // Migrations are the only authority over the schema. `loadEnv` refuses to
    // let synchronize through in production.
    synchronize: env.database.synchronize,

    // Applied automatically on boot so installing an instance stays a single
    // `docker compose up` (NFR 15) — a small NGO should not have to run a
    // migration command after every update.
    migrationsRun: true,
    migrationsTransactionMode: 'each',

    logging:
      env.nodeEnv === 'development'
        ? ['error', 'warn', 'migration']
        : ['error', 'warn'],
  };
}
