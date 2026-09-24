import * as pg from 'pg';
import type { DataSourceOptions } from 'typeorm';
import type { TrefaroEnv } from '../core/config/env';
import { QuietDatabaseLogger } from './database-logger';
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
    // Passed explicitly rather than left to TypeORM's `require('pg')`. A dynamic
    // require is invisible to the bundler, so the driver would be missing from
    // the server image's generated dependency list and the container would fail
    // on its first connection.
    driver: pg,
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

    // A logger of our own rather than a level list, because the level list is
    // not the decision that matters: TypeORM's own logger appends the
    // parameters of a failing statement to it, and at the `error` level, which
    // every environment here has on. `QuietDatabaseLogger` writes the same
    // statements without the values in them (NFR 11, NFR 7).
    logger: new QuietDatabaseLogger(
      env.nodeEnv === 'development'
        ? ['error', 'warn', 'migration', 'schema']
        : ['error', 'warn', 'migration'],
    ),
  };
}
