import { RuntimeMetricsService } from './runtime-metrics.service';

describe('RuntimeMetricsService', () => {
  it('starts at zero and says since when', () => {
    const metrics = new RuntimeMetricsService(() =>
      Date.parse('2026-09-24T08:00:00Z'),
    );

    const snapshot = metrics.snapshot();

    expect(snapshot.startedAt).toBe('2026-09-24T08:00:00.000Z');
    expect(snapshot.uptimeSeconds).toBe(0);
    expect(snapshot.requests).toEqual({
      succeeded: 0,
      clientErrors: 0,
      throttled: 0,
      serverErrors: 0,
    });
    expect(snapshot.lastIncident).toBeNull();
  });

  it('counts an answer by what it says about the instance', () => {
    const metrics = new RuntimeMetricsService();

    metrics.recordSuccess();
    metrics.recordSuccess();
    metrics.recordFailure(404, '/api/events/unknown');
    metrics.recordFailure(429, '/api/admin/auth/login');
    metrics.recordFailure(500, '/api/admin/events', 'a1b2c3d4');

    expect(metrics.snapshot().requests).toEqual({
      succeeded: 2,
      // 429 is counted apart from the other 4xx on purpose: every other client
      // error says something about the caller, and this one says something
      // about the limits of this instance (E60).
      clientErrors: 1,
      throttled: 1,
      serverErrors: 1,
    });
  });

  it('remembers the last fault by its mark, so a log can be searched for it', () => {
    const metrics = new RuntimeMetricsService(() =>
      Date.parse('2026-09-24T09:30:00Z'),
    );

    metrics.recordFailure(500, '/api/admin/events?search=…', 'a1b2c3d4');
    metrics.recordFailure(400, '/api/admin/events', undefined);

    expect(metrics.snapshot().lastIncident).toEqual({
      incident: 'a1b2c3d4',
      at: '2026-09-24T09:30:00.000Z',
      status: 500,
      path: '/api/admin/events?search=…',
    });
  });

  it('counts mail, because mail is what stops working without saying so', () => {
    const metrics = new RuntimeMetricsService(() =>
      Date.parse('2026-09-24T10:00:00Z'),
    );

    metrics.recordMailSent();
    metrics.recordMailSent();
    metrics.recordMailFailure();

    expect(metrics.snapshot().mail).toEqual({
      sent: 2,
      failed: 1,
      lastFailureAt: '2026-09-24T10:00:00.000Z',
    });
  });

  it('reports how long it has been up', () => {
    let now = Date.parse('2026-09-24T08:00:00Z');
    const metrics = new RuntimeMetricsService(() => now);

    now += 90_000;

    expect(metrics.snapshot().uptimeSeconds).toBe(90);
  });
});
