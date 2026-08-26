import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Enabled state and settings of one core module or plug-in (FR 1.5).
 *
 * `module_key` is the primary key: it is the stable identifier a module is
 * released under and it must be unique anyway, so a surrogate id would only add
 * a second thing to keep consistent. (The schema draft in the requirements
 * document lists a separate `id`; this is a deliberate simplification.)
 */
@Entity({ name: 'module_config' })
export class ModuleConfigEntity {
  @PrimaryColumn({ name: 'module_key', type: 'varchar', length: 64 })
  moduleKey!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  /** Module-specific settings; JSONB so a module may evolve its own shape. */
  @Column({
    name: 'settings_json',
    type: 'jsonb',
    default: () => `'{}'::jsonb`,
  })
  settings!: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
