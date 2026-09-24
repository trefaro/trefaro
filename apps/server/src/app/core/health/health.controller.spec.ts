import { HealthController } from './health.controller';

describe('the health endpoint', () => {
  it('is ok while the database answers', async () => {
    const controller = new HealthController({ probe: async () => 3 });

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
  });

  it('is degraded rather than broken when the database is gone', async () => {
    // The distinction the endpoint exists for: a server that is up but cannot
    // reach PostgreSQL is a different operational problem from a server that
    // is gone, and a proxy has to be able to tell them apart.
    const controller = new HealthController({ probe: async () => null });

    await expect(controller.check()).resolves.toEqual({
      status: 'degraded',
      database: 'down',
    });
  });
});
