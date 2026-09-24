import type { LoggerService } from '@nestjs/common';
import { QuietDatabaseLogger } from './database-logger';

/** A sink that remembers everything, so a test can assert what never arrives. */
function recorder(): LoggerService & { readonly everything: () => string } {
  const lines: string[] = [];
  const write = (message: unknown, ...rest: unknown[]) => {
    lines.push([message, ...rest].map(String).join(' '));
  };
  return {
    log: write,
    warn: write,
    error: write,
    debug: write,
    verbose: write,
    everything: () => lines.join('\n'),
  };
}

const LOGIN_QUERY =
  'SELECT "admin"."id" FROM "admin_user" "admin" WHERE "admin"."email" = $1';
const PARAMETERS = ['someone@example.org', 'a-secret-token'];

describe('QuietDatabaseLogger', () => {
  it('reports a failed query with its statement and its error', () => {
    const sink = recorder();

    new QuietDatabaseLogger(['error'], sink).logQueryError(
      new Error('relation "admin_user" does not exist'),
      LOGIN_QUERY,
      PARAMETERS,
    );

    expect(sink.everything()).toContain('admin_user');
    expect(sink.everything()).toContain('does not exist');
  });

  it('never writes the values a query was given', () => {
    const sink = recorder();
    const logger = new QuietDatabaseLogger(
      ['query', 'error', 'warn', 'info', 'log', 'migration', 'schema'],
      sink,
    );

    logger.logQuery(LOGIN_QUERY, PARAMETERS);
    logger.logQueryError(
      new Error('deadlock detected'),
      LOGIN_QUERY,
      PARAMETERS,
    );
    logger.logQuerySlow(4200, LOGIN_QUERY, PARAMETERS);

    // The whole reason this class exists: TypeORM's own logger appends
    // `-- PARAMETERS: ["someone@example.org"]` to every one of those three.
    for (const value of PARAMETERS) {
      expect(sink.everything()).not.toContain(value);
    }
  });

  it('says how many values there were, so a statement stays readable', () => {
    const sink = recorder();

    new QuietDatabaseLogger(['error'], sink).logQueryError(
      'no connection',
      LOGIN_QUERY,
      PARAMETERS,
    );

    expect(sink.everything()).toContain('2 parameter');
  });

  it('stays silent about a query that worked unless asked', () => {
    const sink = recorder();

    new QuietDatabaseLogger(['error', 'warn'], sink).logQuery(LOGIN_QUERY);

    expect(sink.everything()).toBe('');
  });

  it('writes a slow query only when it is asked for queries at all', () => {
    const quiet = recorder();
    const loud = recorder();

    new QuietDatabaseLogger(['error'], quiet).logQuerySlow(3000, LOGIN_QUERY);
    new QuietDatabaseLogger(['query'], loud).logQuerySlow(3000, LOGIN_QUERY);

    expect(quiet.everything()).toBe('');
    expect(loud.everything()).toContain('3000');
  });

  it('passes migrations and schema notices through, because a boot is read', () => {
    const sink = recorder();
    const logger = new QuietDatabaseLogger(['migration', 'schema'], sink);

    logger.logMigration('1787789200000-ParticipantOverview has been executed');
    logger.logSchemaBuild('creating index "idx_registration_event"');

    expect(sink.everything()).toContain('ParticipantOverview');
    expect(sink.everything()).toContain('idx_registration_event');
  });

  it('routes TypeORM’s own notices at the level TypeORM chose', () => {
    const sink = recorder();

    new QuietDatabaseLogger(['warn'], sink).log('warn', 'a table is missing');
    new QuietDatabaseLogger(['warn'], sink).log('log', 'ignored');

    expect(sink.everything()).toBe('a table is missing');
  });
});
