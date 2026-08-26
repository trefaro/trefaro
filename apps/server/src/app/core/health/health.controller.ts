import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

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
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Liveness and database reachability' })
  async check(): Promise<HealthReport> {
    let database: HealthReport['database'] = 'down';
    try {
      await this.dataSource.query('SELECT 1');
      database = 'up';
    } catch {
      // Reported through the payload; the exception filter would turn this into
      // a 500 and hide which dependency actually failed.
    }
    return { status: database === 'up' ? 'ok' : 'degraded', database };
  }
}
