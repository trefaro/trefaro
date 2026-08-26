/** Port for the per-module enabled flag and settings (FR 1.5). */

export interface ModuleConfigRecord {
  readonly moduleKey: string;
  readonly enabled: boolean;
  /** Free-form module settings, persisted as JSONB. */
  readonly settings: Readonly<Record<string, unknown>>;
}

/** A module's default state, used the first time an instance sees it. */
export interface ModuleDefault {
  readonly moduleKey: string;
  readonly enabled: boolean;
}

export interface ModuleConfigRepository {
  findAll(): Promise<readonly ModuleConfigRecord[]>;
  /**
   * Creates a row for every module that has none yet, leaving existing rows
   * untouched. Called at boot so a newly shipped module appears in the
   * administration without a manual database step.
   */
  ensureDefaults(defaults: readonly ModuleDefault[]): Promise<void>;
  setEnabled(moduleKey: string, enabled: boolean): Promise<ModuleConfigRecord>;
}

export const MODULE_CONFIG_REPOSITORY = Symbol(
  'TREFARO_MODULE_CONFIG_REPOSITORY',
);
