import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './app/data-access/data-source';
import { loadEnv } from './app/core/config/env';
import { collectPluginPersistence } from './app/data-access/plugin-data-access/plugin-persistence.registry';
import { CURATED_PLUGINS } from './plugins';

/**
 * Data source for the TypeORM CLI.
 *
 * A second, minimal composition root: it assembles the same core and plug-in
 * migrations the server uses, so `migration:generate` compares against the full
 * schema and never proposes dropping a plug-in's tables.
 *
 * Not imported by the server — it exists for `nx run server:migration:*`.
 */
export default new DataSource({
  ...buildDataSourceOptions(
    loadEnv(),
    collectPluginPersistence(
      CURATED_PLUGINS.map((plugin) => plugin.persistence),
    ),
  ),
  // The CLI decides when to run migrations; it must not do so on connect.
  migrationsRun: false,
});
