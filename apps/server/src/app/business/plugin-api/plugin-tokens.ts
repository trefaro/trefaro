/**
 * Injection tokens forming the seam between the layers.
 *
 * The business layer depends on these symbols and on the interfaces they stand
 * for — never on an implementation. The composition root binds them, which is
 * what keeps the data access layer replaceable.
 */

/** Multi-provider holding every curated {@link ServerPlugin} in the image. */
export const SERVER_PLUGINS = Symbol('TREFARO_SERVER_PLUGINS');

/**
 * Registry the data access layer reads to learn which entities and migrations
 * the mounted plug-ins contribute.
 */
export const PLUGIN_PERSISTENCE_REGISTRY = Symbol(
  'TREFARO_PLUGIN_PERSISTENCE_REGISTRY',
);
