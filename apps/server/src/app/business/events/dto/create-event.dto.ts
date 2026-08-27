import { ApiProperty, PartialType } from '@nestjs/swagger';
import type { EventStatus, EventType } from '@trefaro/shared-models';
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  MAX_FOLLOW_UP_LENGTH,
} from '@trefaro/shared-models';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { MAX_SLUG_LENGTH } from '../../common/slug';

/** Bounds that also match the columns, so a request cannot fail in the database. */
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5_000;
const MAX_VENUE_NAME_LENGTH = 200;
const MAX_VENUE_ADDRESS_LENGTH = 2_000;
const MAX_TIMEZONE_LENGTH = 64;
const MAX_LANGUAGES = 20;

/** A BCP 47 tag such as `en`, `de`, or `pt-BR`. */
const LANGUAGE_TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export class CreateEventDto {
  @ApiProperty({ example: 'Kickoff in Cologne' })
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  name!: string;

  @ApiProperty({ description: 'Mandatory, per FR 3.1.' })
  @IsString()
  @Length(1, MAX_DESCRIPTION_LENGTH)
  description!: string;

  @ApiProperty({
    required: false,
    description:
      'Readable part of the public URL, unique within the series. Derived from ' +
      'the name when omitted; a numbered suffix is added if it is already taken.',
    example: 'kickoff-cologne',
  })
  @IsOptional()
  @IsString()
  @Length(1, MAX_SLUG_LENGTH)
  slug?: string;

  @ApiProperty({ enum: EVENT_TYPES as string[], description: 'FR 3.9.' })
  @IsIn(EVENT_TYPES as string[])
  eventType!: EventType;

  @ApiProperty({
    format: 'date-time',
    description: 'Absolute instant. Read it in `timezone`, not in UTC.',
    example: '2027-03-14T08:00:00.000Z',
  })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ format: 'date-time', example: '2027-03-14T16:00:00.000Z' })
  @IsDateString()
  endsAt!: string;

  @ApiProperty({
    description:
      'IANA zone of the venue — the zone times are rendered in (E8).',
    example: 'Europe/Berlin',
  })
  @IsString()
  @Length(1, MAX_TIMEZONE_LENGTH)
  timezone!: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Required before an on-site or hybrid event can be published.',
    example: 'Bürgerhaus Kalk',
  })
  @IsOptional()
  @IsString()
  @Length(1, MAX_VENUE_NAME_LENGTH)
  venueName?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Free text: address formats differ too much per country to split.',
  })
  @IsOptional()
  @IsString()
  @Length(1, MAX_VENUE_ADDRESS_LENGTH)
  venueAddress?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Required before an online or hybrid event can be published.',
  })
  @IsOptional()
  // `require_protocol` because a bare word would otherwise pass and then render
  // as a broken link.
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  onlineUrl?: string | null;

  @ApiProperty({
    type: [String],
    description: 'BCP 47 tags of the languages the event is held in (FR 3.1).',
    example: ['de', 'en'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_LANGUAGES)
  @Matches(LANGUAGE_TAG, { each: true })
  languages!: string[];

  @ApiProperty({
    required: false,
    enum: EVENT_STATUSES as string[],
    description:
      'Defaults to draft. Publishing requires a venue, a link, or both — ' +
      'whichever the event type makes reachable.',
  })
  @IsOptional()
  @IsIn(EVENT_STATUSES as string[])
  status?: EventStatus;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'What participants read once the event is over (FR 3.6, UC 10). Written ' +
      'whenever the organizer likes and shown only after the event has ended ' +
      '(F50) — so it can be prepared in advance.',
    example:
      'Thank you for coming. The recordings are linked below; the next ' +
      'Democracy Day is on 14 June.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_FOLLOW_UP_LENGTH)
  followUpBody?: string | null;
}

/** Every field optional; only what is sent gets written. */
export class UpdateEventDto extends PartialType(CreateEventDto) {}
