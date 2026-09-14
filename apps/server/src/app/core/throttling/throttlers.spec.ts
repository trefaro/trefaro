import type { ExecutionContext } from '@nestjs/common';
import { RATE_LIMIT_DEFAULTS, type RateLimitEnv } from '../config/rate-limits';
import { RateLimit } from './rate-limit.decorator';
import { buildThrottlers } from './throttlers';

const limits: RateLimitEnv = { ...RATE_LIMIT_DEFAULTS, profile: null };

class Routes {
  @RateLimit('login')
  logIn(): void {
    /* a route only needs to exist to carry metadata */
  }

  @RateLimit('registration')
  register(): void {
    /* as above */
  }

  untagged(): void {
    /* as above */
  }
}

/** The two things a `skipIf` asks an execution context for. */
function contextOf(handler: () => void): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Routes,
  } as unknown as ExecutionContext;
}

const byName = (name: string) =>
  buildThrottlers(limits).find((throttler) => throttler.name === name);

describe('buildThrottlers', () => {
  it('keeps the generous global default every route has always had', () => {
    const fallback = byName('default');

    expect(fallback).toMatchObject({ limit: 300, ttl: 60_000 });
    // No `skipIf`: the global limit is the one thing that applies everywhere.
    expect(fallback?.skipIf).toBeUndefined();
  });

  it('takes each named limit from the configured environment', () => {
    const configured = buildThrottlers({
      ...limits,
      loginAttemptsPerWindow: 5,
      registrationsPerWindow: 7,
      newsletterSignupsPerWindow: 9,
      confirmationsPerWindow: 11,
    });

    expect(configured.map((t) => [t.name, t.limit])).toEqual(
      expect.arrayContaining([
        ['login', 5],
        ['registration', 7],
        ['newsletter-signup', 9],
        ['confirmation', 11],
      ]),
    );
  });

  it('counts a named limit over five minutes, and blocks a login for fifteen', () => {
    expect(byName('login')).toMatchObject({
      ttl: 300_000,
      blockDuration: 900_000,
    });
    // Deliberately no block period, unlike the login: somebody who mistypes
    // their address has to be able to fix it.
    expect(byName('registration')?.blockDuration).toBeUndefined();
  });

  it('applies a named limit only to the routes that asked for it', () => {
    const login = byName('login');

    expect(login?.skipIf?.(contextOf(Routes.prototype.logIn))).toBe(false);
    expect(login?.skipIf?.(contextOf(Routes.prototype.register))).toBe(true);
    expect(login?.skipIf?.(contextOf(Routes.prototype.untagged))).toBe(true);
  });
});
