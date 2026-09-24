import type { LogLevel } from '@nestjs/common';

/**
 * How much this instance writes, and why it is a decision rather than a default.
 *
 * Nest's default logger has every level on — `log`, `error`, `warn`, `debug`,
 * `verbose`, `fatal` — in every environment. That undoes something the
 * exception filter does on purpose: it writes an expected 401 or 404 at
 * `debug`, "not warnings, because every client that is not logged in asks who
 * it is", and with the default those lines reach a production log all the
 * same. A log that grows with visitors instead of with problems is a log an
 * operator stops reading, which is the failure mode NFR 11 is about.
 *
 * So the level is read from `LOG_LEVEL`, with a default per environment, and
 * this instance says out loud when somebody has moved it — the same shape as
 * the rate limits (E60) and the mail settings (E62): silence means the
 * defaults, and a line means a decision.
 */

/** Loudest last. A chosen level switches on itself and everything before it. */
const LADDER: readonly LogLevel[] = [
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
];

/**
 * The quietest level this server accepts, and the reason it has a floor at all.
 *
 * Below `warn` an instance can no longer tell its own operator that a limit was
 * raised (E60) or that mail leaves unencrypted (E62) — both of those are
 * warnings, and both are the record of a decision somebody made. A setting that
 * can silence them is a setting that can make a deployment unauditable from its
 * own log, so `error` and `fatal` are not offered.
 */
const FLOOR: LogLevel = 'warn';

const OFFERED: readonly LogLevel[] = LADDER.slice(LADDER.indexOf(FLOOR));

/** What an instance writes when nobody has said otherwise. */
export const DEFAULT_LOG_LEVEL: Readonly<
  Record<'production' | 'other', LogLevel>
> = {
  production: 'log',
  other: 'debug',
};

type Source = Readonly<Record<string, string | undefined>>;

function defaultFor(source: Source): LogLevel {
  return source['NODE_ENV']?.trim() === 'production'
    ? DEFAULT_LOG_LEVEL.production
    : DEFAULT_LOG_LEVEL.other;
}

function requested(source: Source): string {
  return source['LOG_LEVEL']?.trim().toLowerCase() ?? '';
}

function chosen(source: Source): LogLevel {
  const asked = requested(source);
  return OFFERED.includes(asked as LogLevel)
    ? (asked as LogLevel)
    : defaultFor(source);
}

/** The levels to hand `NestFactory.create`, quietest first. */
export function logLevelsFor(source: Source = process.env): LogLevel[] {
  return LADDER.slice(0, LADDER.indexOf(chosen(source)) + 1);
}

/**
 * What to say on the way up about the level this instance is running at.
 *
 * Empty for an instance running its default, which is what makes a line here
 * worth reading. Not part of `startupWarnings` (business/setup) for the reason
 * the rate limits are not either: that list answers "what is missing from this
 * deployment", and a chosen log level is not missing.
 */
export function logLevelWarnings(source: Source = process.env): string[] {
  const asked = requested(source);
  if (asked === '') return [];

  if (!OFFERED.includes(asked as LogLevel)) {
    return [
      `LOG_LEVEL is "${asked}", which is not one of ${OFFERED.join(', ')} — ` +
        `running at "${defaultFor(source)}" instead. ` +
        (LADDER.includes(asked as LogLevel)
          ? 'Quieter than warn is not offered: the lines that say a limit was ' +
            'raised (E60) or that mail leaves unencrypted (E62) are warnings, ' +
            'and an instance that cannot print them cannot be checked from its ' +
            'own log.'
          : ''),
    ];
  }

  const level = asked as LogLevel;
  const noisier =
    LADDER.indexOf(level) > LADDER.indexOf(DEFAULT_LOG_LEVEL.production);
  if (source['NODE_ENV']?.trim() === 'production' && noisier) {
    return [
      `LOG_LEVEL is "${level}" in production — every 401 and every 404 is ` +
        'written now, and those are the traffic of a normal day rather than ' +
        'its problems. Useful while chasing something, and worth putting back.',
    ];
  }

  return [];
}
