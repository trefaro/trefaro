import type { EntitySchema, MigrationInterface } from 'typeorm';
import type { PluginPersistenceContribution } from '../../business/plugin-api';

/**
 * Data access plug-in manager.
 *
 * The business layer forwards each plug-in's persistence contribution as opaque
 * values; this is the one place that interprets them as ORM artifacts. Keeping
 * the cast here is what lets the business layer stay free of ORM types, and
 * therefore what keeps a database change confined to this layer.
 */

/** An entity class or a TypeORM entity schema. */
export type PluginEntity = (new (...args: never[]) => object) | EntitySchema;

/** A migration class, instantiable by TypeORM. */
export type PluginMigration = new () => MigrationInterface;

export interface CollectedPluginPersistence {
  readonly entities: readonly PluginEntity[];
  readonly migrations: readonly PluginMigration[];
}

/**
 * Flattens the contributions of all mounted plug-ins into the entity and
 * migration lists the data source needs.
 *
 * A plug-in contributes only its own tables. That its migrations never touch
 * core tables is part of the plug-in contract and is checked when a plug-in is
 * reviewed — it cannot be enforced here, because a migration is arbitrary SQL.
 */
export function collectPluginPersistence(
  contributions: readonly PluginPersistenceContribution[],
): CollectedPluginPersistence {
  return {
    entities: contributions.flatMap(
      (contribution) => contribution.entities as readonly PluginEntity[],
    ),
    migrations: contributions.flatMap(
      (contribution) => contribution.migrations as readonly PluginMigration[],
    ),
  };
}
