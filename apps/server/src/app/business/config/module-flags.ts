import { Logger } from '@nestjs/common';
import type {
  ModuleConfigRepository,
  ModuleDefault,
} from './ports/module-config.repository';

/**
 * How often the enabled flags are re-read.
 *
 * Short enough that switching a module on feels immediate, long enough to be
 * irrelevant next to normal query load. One number for plug-ins and core
 * modules alike: two intervals would be two answers to "how long until my change
 * takes effect".
 */
export const MODULE_FLAG_REFRESH_MS = 15_000;

/**
 * Cached view of the `module_config` flags of one family of modules.
 *
 * Both families need the same three things, so they share them:
 *
 * - a row per module on first boot, so a module shipped by a newer version
 *   appears without a manual database step;
 * - the flags in memory, because a guard on every request must not be a database
 *   round trip;
 * - a periodic re-read, which is what makes activation a configuration change
 *   rather than a redeploy (F6) — including a change made directly in the table,
 *   before the module administration UI of phase 2 exists.
 *
 * Not a provider: the two registries own one of these each and give it the keys
 * they are responsible for. Everything the flags mean — which keys exist, what a
 * disabled module does — stays with its owner.
 */
export class ModuleFlagCache {
  private known = new Set<string>();
  private enabled = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;

  /**
   * @param label how the log line names this family, e.g. `Plug-ins`.
   */
  constructor(
    private readonly moduleConfig: ModuleConfigRepository,
    private readonly label: string,
    private readonly logger: Pick<Logger, 'log' | 'warn'>,
  ) {}

  /**
   * Seeds the defaults, reads the flags once and starts the refresh.
   *
   * Called from `onApplicationBootstrap`, so TypeORM has connected and writing
   * defaults is safe. The keys given here are also the keys this cache accepts:
   * a `module_config` row for something else — a plug-in's flag read by the core
   * modules' cache, say — is ignored rather than answered for.
   */
  async start(defaults: readonly ModuleDefault[]): Promise<void> {
    this.known = new Set(defaults.map((entry) => entry.moduleKey));
    await this.moduleConfig.ensureDefaults(defaults);
    await this.refresh();

    // `unref` so the timer never keeps the process alive: a container must still
    // stop on SIGTERM.
    this.timer = setInterval(() => {
      void this.refresh().catch((error: unknown) =>
        this.logger.warn(
          `Could not refresh ${this.label.toLowerCase()} configuration: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }, MODULE_FLAG_REFRESH_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Re-reads the flags.
   *
   * A failure leaves the last known state standing — a blip in the database must
   * not silently switch everything off. The caller logs; this only throws.
   */
  async refresh(): Promise<void> {
    const previous = this.enabled;
    const records = await this.moduleConfig.findAll();
    this.enabled = new Set(
      records
        .filter((record) => record.enabled && this.known.has(record.moduleKey))
        .map((record) => record.moduleKey),
    );

    // Logged only when it actually changed — this runs on a timer, and a line
    // every few seconds would bury everything else.
    if (!sameKeys(previous, this.enabled)) {
      this.logger.log(
        `${this.label} enabled: ${
          this.enabled.size === 0 ? '(none)' : this.keys().join(', ')
        }`,
      );
    }
  }

  isEnabled(moduleKey: string): boolean {
    return this.enabled.has(moduleKey);
  }

  /** The enabled keys, sorted — a stable order for a payload and a log line. */
  keys(): readonly string[] {
    return [...this.enabled].sort();
  }
}

function sameKeys(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((key) => b.has(key));
}
