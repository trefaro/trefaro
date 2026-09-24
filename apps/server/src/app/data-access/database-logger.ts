import { Logger, type LoggerService } from '@nestjs/common';
// From the package root and not from `typeorm/logger/Logger`: a deep import
// into TypeORM's own layout resolves under `tsc` and not under the spec
// runner, and the file that finds out is whichever one imports `AppModule`
// next (`docs/rules/tooling-traps.md`).
import type { Logger as TypeOrmLogger, LogLevel, ObjectLiteral } from 'typeorm';

/**
 * TypeORM's logging, with the values taken out (NFR 11, NFR 7).
 *
 * TypeORM's own logger appends the parameters of a statement to it:
 *
 *     query failed: SELECT … FROM "admin_user" WHERE "email" = $1
 *       -- PARAMETERS: ["someone@example.org"]
 *
 * and it does that at the `error` level, which every environment of this
 * server has switched on, production included. So a database that hiccups
 * during a sign-in writes an address into the log — and a password reset
 * writes the token that resets it. Nobody decided that; it is what a default
 * does.
 *
 * The statement still goes in the log, because a failed query without its SQL
 * is a line an operator cannot act on. What goes instead of the values is
 * **how many there were**, which keeps the `$1, $2` of the statement readable
 * without saying what stood in them. An operator who needs the values has the
 * row, and the row is in the application.
 *
 * It also brings TypeORM's output into the same stream and the same format as
 * everything else the server writes: before this, one of the two wrote through
 * Nest and the other straight to the console, so a boot produced two kinds of
 * line and neither carried the other's context.
 *
 * @see log-hygiene.spec.ts — the same rule, for the lines this server writes
 * itself.
 */
export class QuietDatabaseLogger implements TypeOrmLogger {
  constructor(
    /** Exactly the levels `buildDataSourceOptions` would have passed TypeORM. */
    private readonly levels: readonly LogLevel[],
    private readonly logger: LoggerService = new Logger('Database'),
  ) {}

  logQuery(query: string, parameters?: unknown[] | ObjectLiteral): void {
    if (!this.enabled('query')) return;
    this.logger.debug?.(this.describe(query, parameters));
  }

  logQueryError(
    error: string | Error,
    query: string,
    parameters?: unknown[] | ObjectLiteral,
  ): void {
    if (!this.enabled('error')) return;
    const reason = error instanceof Error ? error.message : error;
    this.logger.error(`${reason} — ${this.describe(query, parameters)}`);
  }

  logQuerySlow(
    time: number,
    query: string,
    parameters?: unknown[] | ObjectLiteral,
  ): void {
    // Tied to `query` rather than to `warn`: a slow statement is only worth a
    // line where somebody is reading statements, and on a small instance the
    // slowest query of the day is usually a migration.
    if (!this.enabled('query')) return;
    this.logger.warn(`${time}ms — ${this.describe(query, parameters)}`);
  }

  logSchemaBuild(message: string): void {
    if (!this.enabled('schema')) return;
    this.logger.log(message);
  }

  logMigration(message: string): void {
    if (!this.enabled('migration')) return;
    this.logger.log(message);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown): void {
    if (!this.enabled(level)) return;
    if (level === 'warn') this.logger.warn(String(message));
    else this.logger.log(String(message));
  }

  private enabled(level: LogLevel): boolean {
    return this.levels.includes(level);
  }

  /** The statement, and the count of the values it was given — never the values. */
  private describe(
    query: string,
    parameters?: unknown[] | ObjectLiteral,
  ): string {
    const count = Array.isArray(parameters)
      ? parameters.length
      : Object.keys(parameters ?? {}).length;
    return count === 0
      ? query
      : `${query} (${count} parameter${count === 1 ? '' : 's'} not shown)`;
  }
}
