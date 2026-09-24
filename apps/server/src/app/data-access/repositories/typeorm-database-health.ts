import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { DatabaseHealth } from '../../core/health/database-health.port';

/**
 * The cheapest question there is, asked of PostgreSQL.
 *
 * Swallowing the error is deliberate and is not the same as hiding it: a
 * failed statement is written by `QuietDatabaseLogger` before this ever
 * returns, with the reason and without the values. What this returns is the
 * *state*, which is what a health endpoint and an operations report are for.
 */
@Injectable()
export class TypeormDatabaseHealth implements DatabaseHealth {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async probe(): Promise<number | null> {
    const started = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return Date.now() - started;
    } catch {
      return null;
    }
  }
}
