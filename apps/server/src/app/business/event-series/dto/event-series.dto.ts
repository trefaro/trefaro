import { ApiProperty } from '@nestjs/swagger';
import type {
  EventSeries,
  EventSeriesStatus,
  PublicEventSeries,
} from '@trefaro/shared-models';
import { EVENT_SERIES_STATUSES } from '@trefaro/shared-models';

/**
 * OpenAPI shapes for event series.
 *
 * Each class `implements` the interface from `@trefaro/shared-models`, so the
 * documented API and the types both clients compile against cannot drift apart.
 */
export class PublicEventSeriesDto implements PublicEventSeries {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'climate-conference-2027' })
  slug!: string;

  @ApiProperty({ example: 'Climate Conference 2027' })
  name!: string;

  @ApiProperty({
    example: 'Three days on citizen participation in climate policy.',
  })
  description!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Served by this instance, never a third-party URL (NFR 9).',
    example: '/api/media/series/climate.svg',
  })
  logoUrl!: string | null;

  @ApiProperty({ nullable: true, type: String })
  websiteUrl!: string | null;

  @ApiProperty({ nullable: true, type: String })
  contactEmail!: string | null;
}

export class EventSeriesDto
  extends PublicEventSeriesDto
  implements EventSeries
{
  @ApiProperty({ enum: EVENT_SERIES_STATUSES as string[] })
  status!: EventSeriesStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
