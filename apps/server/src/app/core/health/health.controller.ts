import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DATABASE_HEALTH, type DatabaseHealth } from './database-health.port';

interface HealthReport {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
}

/**
 * Liveness endpoint for the container health check and the reverse proxy.
 *
 * Reports the database as a separate field rather than failing the whole check:
 * a server that is up but cannot reach PostgreSQL is a different operational
 * problem from a server that is gone, and an operator needs to tell them apart.
 *
 * Two words and no numbers, because this one is **public** (it is what a proxy
 * and a container health check ask, and neither of those can sign in). What an
 * operator needs beyond "is it alive" lives behind a session, in
 * `core/operations/` (AP 10 of phase 5).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE_HEALTH) private readonly database: DatabaseHealth,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness and database reachability' })
  async check(): Promise<HealthReport> {
    const reachable = (await this.database.probe()) !== null;
    return {
      status: reachable ? 'ok' : 'degraded',
      database: reachable ? 'up' : 'down',
    };
  }
}
