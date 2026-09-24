import type { Provider } from '@nestjs/common';
import { DataAccessModule } from './data-access.module';

/**
 * That every port this layer implements is actually handed out.
 *
 * A port is a symbol, and binding one is two lines that live thirty lines
 * apart: the `provide:` in `providers` and the same symbol in `exports`. Write
 * the first and forget the second and nothing complains — not the compiler,
 * not the linter, not a single unit test, because every service that needs the
 * port is constructed directly in its own spec. The first thing that finds out
 * is a container that will not start, and it says so about the *consumer*
 * ("Nest can't resolve dependencies of the HealthController"), which is the
 * one file that is not at fault.
 *
 * That happened in AP 10 of phase 5 with `DATABASE_HEALTH`, the twenty-line
 * port that took `SELECT 1` out of a controller. This is the check that costs
 * a second instead of a rebuild.
 *
 * Classes are deliberately not required to be exported: a `TypeormXRepository`
 * is this layer's own business, and the whole point of the arrangement is that
 * nothing outside it names one.
 */
function tokensOf(providers: readonly Provider[]): symbol[] {
  return providers
    .map((provider) =>
      typeof provider === 'object' && 'provide' in provider
        ? provider.provide
        : null,
    )
    .filter((token): token is symbol => typeof token === 'symbol');
}

describe('DataAccessModule', () => {
  const module = DataAccessModule.forRoot();

  it('binds a good number of ports — so this scan is looking at a real list', () => {
    // Guards the check below: a `tokensOf` that stopped recognising anything
    // would make it pass over nothing.
    expect(tokensOf(module.providers ?? []).length).toBeGreaterThan(30);
  });

  it('exports every port it binds', () => {
    const exported = new Set(module.exports ?? []);
    const unexported = tokensOf(module.providers ?? [])
      .filter((token) => !exported.has(token))
      .map((token) => token.toString());

    expect(unexported).toEqual([]);
  });
});
