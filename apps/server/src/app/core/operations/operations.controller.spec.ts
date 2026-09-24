import { OperationsController } from './operations.controller';
import { RuntimeMetricsService } from './runtime-metrics.service';

describe('the operations report', () => {
  it('says the database answers, and how quickly', async () => {
    const report = await new OperationsController(new RuntimeMetricsService(), {
      probe: async () => 4,
    }).report();

    expect(report.database).toEqual({ reachable: true, latencyMs: 4 });
  });

  it('answers at all when the database does not', async () => {
    // The point of an operations endpoint: the moment it is most needed is the
    // moment a dependency is down, so it must not need that dependency.
    const report = await new OperationsController(new RuntimeMetricsService(), {
      probe: async () => null,
    }).report();

    expect(report.database).toEqual({ reachable: false, latencyMs: null });
    expect(report.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('passes the tally through, mark and all', async () => {
    const metrics = new RuntimeMetricsService();
    metrics.recordSuccess();
    metrics.recordFailure(500, '/api/admin/events?search=…', 'a1b2c3d4');
    metrics.recordMailFailure();

    const report = await new OperationsController(metrics, {
      probe: async () => 1,
    }).report();

    expect(report.requests).toMatchObject({ succeeded: 1, serverErrors: 1 });
    expect(report.lastIncident?.incident).toBe('a1b2c3d4');
    expect(report.mail.failed).toBe(1);
  });

  it('reports memory in a unit somebody reads', async () => {
    const report = await new OperationsController(new RuntimeMetricsService(), {
      probe: async () => 1,
    }).report();

    expect(report.memory.residentMb).toBeGreaterThan(1);
    expect(report.memory.residentMb).toBeLessThan(10_000);
    expect(report.memory.heapUsedMb).toBeGreaterThan(0);
  });
});
