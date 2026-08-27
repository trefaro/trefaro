import { ApiProperty } from '@nestjs/swagger';
import type {
  EventStatus,
  EventType,
  OrganizerEvent,
  PublicEvent,
} from '@trefaro/shared-models';
import { EVENT_STATUSES, EVENT_TYPES } from '@trefaro/shared-models';

/**
 * OpenAPI shapes for events.
 *
 * Each class `implements` the interface from `@trefaro/shared-models`, so the
 * documented API and the types both clients compile against cannot drift apart.
 */
export class PublicEventDto implements PublicEvent {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'kickoff-cologne' })
  slug!: string;

  @ApiProperty({ example: 'Kickoff in Cologne' })
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Served by this instance, never a third-party URL (NFR 9).',
  })
  logoUrl!: string | null;

  @ApiProperty({ enum: EVENT_TYPES as string[] })
  eventType!: EventType;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({
    example: 'Europe/Berlin',
    description: 'The zone the times above are meant to be read in (E8).',
  })
  timezone!: string;

  @ApiProperty({ nullable: true, type: String })
  venueName!: string | null;

  @ApiProperty({ nullable: true, type: String })
  venueAddress!: string | null;

  @ApiProperty({ nullable: true, type: String })
  onlineUrl!: string | null;

  @ApiProperty({ type: [String], example: ['de', 'en'] })
  languages!: readonly string[];
}

export class OrganizerEventDto
  extends PublicEventDto
  implements OrganizerEvent
{
  @ApiProperty({ format: 'uuid' })
  seriesId!: string;

  @ApiProperty({ enum: EVENT_STATUSES as string[] })
  status!: EventStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
