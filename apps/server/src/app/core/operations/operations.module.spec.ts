import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DATABASE_HEALTH } from '../health/database-health.port';
import { OperationsModule } from './operations.module';
import { RuntimeMetricsService } from './runtime-metrics.service';

/**
 * What `DataAccessModule` publishes in the running server, and publishes the
 * same way: globally. A provider declared beside the import would not be
 * visible inside `OperationsModule`, and a test arranged like that would prove
 * something the application does not do.
 */
@Global()
@Module({
  providers: [{ provide: DATABASE_HEALTH, useValue: { probe: async () => 1 } }],
  exports: [DATABASE_HEALTH],
})
class StubDataAccessModule {}

/**
 * That this module can actually be assembled.
 *
 * Written after the fact, and the fact is worth the file: every unit test of
 * `RuntimeMetricsService` constructs it with `new`, where a default parameter
 * value is simply a default. Nest does not care about default values — it
 * reads the emitted parameter type, finds `Function`, and refuses to build the
 * container. Nothing in this repository boots the module graph (importing
 * `AppModule` into a spec has its own trap, `docs/rules/tooling-traps.md`), so
 * the first thing that found out was a container that would not start.
 *
 * This compiles the one module, which needs no database and no environment,
 * and would have caught it in a second.
 */
describe('OperationsModule', () => {
  it('can be assembled — every dependency of it is resolvable', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [StubDataAccessModule, OperationsModule],
    }).compile();

    expect(moduleRef.get(RuntimeMetricsService)).toBeInstanceOf(
      RuntimeMetricsService,
    );
  });

  it('gives the tally a clock without being handed one', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [StubDataAccessModule, OperationsModule],
    }).compile();

    const snapshot = moduleRef.get(RuntimeMetricsService).snapshot();
    expect(Date.parse(snapshot.startedAt)).toBeGreaterThan(0);
  });
});
