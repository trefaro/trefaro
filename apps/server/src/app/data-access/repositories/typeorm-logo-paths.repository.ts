import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { LogoPathsRepository } from '../../business/logo-files/ports/logo-paths.repository';
import { EventSeriesEntity } from '../entities';

/**
 * PostgreSQL implementation of the logo paths port (FR 2.1, FR 3.1 — E9).
 *
 * Two columns of two tables, read as one list, because its single caller is
 * about to delete both: a series delete cascades to its events, and the cascade
 * takes rows without touching the volume. Asking twice from the business layer
 * would be two round trips for one question and would leave the caller stitching
 * the answer together.
 *
 * Anchored on the series entity rather than the event one, because that is the
 * row the caller names — and a series with no events must still yield its own
 * logo, which a query starting at `event` could not express without a join that
 * returns nothing.
 */
@Injectable()
export class TypeormLogoPathsRepository implements LogoPathsRepository {
  constructor(
    @InjectRepository(EventSeriesEntity)
    private readonly series: Repository<EventSeriesEntity>,
  ) {}

  async underSeries(seriesId: string): Promise<readonly string[]> {
    const rows: { logo_path: string }[] = await this.series.query(
      `
        SELECT "logo_path" FROM "event_series"
          WHERE "id" = $1 AND "logo_path" IS NOT NULL
        UNION ALL
        SELECT "logo_path" FROM "event"
          WHERE "series_id" = $1 AND "logo_path" IS NOT NULL
      `,
      [seriesId],
    );
    return rows.map((row) => row.logo_path);
  }
}
