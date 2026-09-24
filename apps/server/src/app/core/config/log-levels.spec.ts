import { logLevelWarnings, logLevelsFor } from './log-levels';

describe('logLevelsFor', () => {
  it('leaves out debug in production, which is where the default used to be wrong', () => {
    const levels = logLevelsFor({ NODE_ENV: 'production' });

    expect(levels).toContain('log');
    expect(levels).toContain('warn');
    expect(levels).toContain('error');
    // Nest's own default has all six on, so every 401 and every 404 reached an
    // operator's log — the exception filter writes those at `debug` precisely
    // so that they would not.
    expect(levels).not.toContain('debug');
    expect(levels).not.toContain('verbose');
  });

  it('keeps debug while developing, where those lines are the point', () => {
    expect(logLevelsFor({ NODE_ENV: 'development' })).toContain('debug');
  });

  it('takes the level from the environment', () => {
    expect(
      logLevelsFor({ NODE_ENV: 'production', LOG_LEVEL: 'debug' }),
    ).toEqual(expect.arrayContaining(['debug']));
    expect(
      logLevelsFor({ NODE_ENV: 'development', LOG_LEVEL: 'warn' }),
    ).not.toContain('log');
  });

  it('always keeps fatal and error, whatever is asked for', () => {
    for (const level of ['warn', 'log', 'debug', 'verbose']) {
      expect(logLevelsFor({ LOG_LEVEL: level })).toEqual(
        expect.arrayContaining(['error', 'fatal']),
      );
    }
  });

  it('refuses to go quieter than warn, and says so instead of obeying', () => {
    // Not a matter of taste: the startup lines that say a limit was raised
    // (E60) or that mail leaves unencrypted (E62) are warnings, and an
    // instance that cannot print them is one whose configuration nobody can
    // check from its own log.
    expect(
      logLevelsFor({ LOG_LEVEL: 'error', NODE_ENV: 'production' }),
    ).toContain('warn');
    expect(logLevelWarnings({ LOG_LEVEL: 'error' })).toEqual([
      expect.stringContaining('LOG_LEVEL'),
    ]);
  });

  it('falls back on a value it does not know, and names the ones it does', () => {
    expect(
      logLevelsFor({ NODE_ENV: 'production', LOG_LEVEL: 'quiet' }),
    ).toEqual(logLevelsFor({ NODE_ENV: 'production' }));

    const [warning] = logLevelWarnings({ LOG_LEVEL: 'quiet' });
    expect(warning).toContain('quiet');
    expect(warning).toContain('warn, log, debug, verbose');
  });
});

describe('logLevelWarnings', () => {
  it('says nothing about an instance running the defaults', () => {
    expect(logLevelWarnings({ NODE_ENV: 'production' })).toEqual([]);
    expect(logLevelWarnings({ NODE_ENV: 'development' })).toEqual([]);
  });

  it('says nothing about a level that is asked for and sensible', () => {
    expect(
      logLevelWarnings({ NODE_ENV: 'production', LOG_LEVEL: 'warn' }),
    ).toEqual([]);
  });

  it('is loud about debug in production, because the log then grows with visitors', () => {
    const [warning] = logLevelWarnings({
      NODE_ENV: 'production',
      LOG_LEVEL: 'debug',
    });

    expect(warning).toContain('debug');
    expect(warning).toMatch(/401|404/);
  });
});
