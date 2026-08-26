import { InitialCoreSchema1787702400000 } from './1787702400000-InitialCoreSchema';

/**
 * Core migrations, in the order they must run.
 *
 * Listed explicitly rather than discovered by glob: a bundled server has no
 * source tree to scan, and an explicit list makes the order reviewable.
 */
export const CORE_MIGRATIONS = [InitialCoreSchema1787702400000];
