import {
  RATE_LIMIT_DEFAULTS,
  rateLimitWarnings,
  type RateLimitEnv,
} from './rate-limits';

const defaults: RateLimitEnv = { ...RATE_LIMIT_DEFAULTS, profile: null };

describe('rateLimitWarnings', () => {
  it('says nothing about an instance running what it shipped with', () => {
    expect(rateLimitWarnings(defaults)).toEqual([]);
  });

  it('names the variable, the value and the default of a raised limit', () => {
    const [warning, ...rest] = rateLimitWarnings({
      ...defaults,
      registrationsPerWindow: 500,
    });

    expect(warning).toContain('REGISTRATIONS_PER_WINDOW');
    expect(warning).toContain('500');
    expect(warning).toContain(
      String(RATE_LIMIT_DEFAULTS.registrationsPerWindow),
    );
    expect(rest).toEqual([]);
  });

  it('stays quiet about a lowered limit — tightening is the safe direction', () => {
    expect(
      rateLimitWarnings({ ...defaults, loginAttemptsPerWindow: 3 }),
    ).toEqual([]);
  });

  it('warns once per raised limit', () => {
    expect(
      rateLimitWarnings({
        ...defaults,
        loginAttemptsPerWindow: 200,
        confirmationsPerWindow: 500,
      }),
    ).toHaveLength(2);
  });

  // E61: a profile is never what an instance ships, so an instance running one
  // has to say the word — even when the profile raises nothing at all.
  it('announces the profile first, before the limits it explains', () => {
    const warnings = rateLimitWarnings({
      ...defaults,
      profile: 'e2e',
      registrationsPerWindow: 500,
    });

    expect(warnings[0]).toContain('e2e');
    expect(warnings).toHaveLength(2);
  });

  it('announces a profile that raises nothing', () => {
    expect(rateLimitWarnings({ ...defaults, profile: 'e2e' })).toHaveLength(1);
  });
});
