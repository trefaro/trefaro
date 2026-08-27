import { ApiProperty, PartialType } from '@nestjs/swagger';
import type { EventSeriesStatus } from '@trefaro/shared-models';
import { EVENT_SERIES_STATUSES } from '@trefaro/shared-models';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';
import { MAX_SLUG_LENGTH } from '../../common/slug';

/** Bounds that also match the columns, so a request cannot fail in the database. */
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5_000;

export class CreateEventSeriesDto {
  @ApiProperty({ example: 'Climate Conference 2027' })
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  name!: string;

  @ApiProperty({ description: 'Mandatory, per FR 2.1.' })
  @IsString()
  @Length(1, MAX_DESCRIPTION_LENGTH)
  description!: string;

  @ApiProperty({
    required: false,
    description:
      'Readable part of the public URL. Derived from the name when omitted; ' +
      'a numbered suffix is added if it is already taken.',
    example: 'climate-conference-2027',
  })
  @IsOptional()
  @IsString()
  @Length(1, MAX_SLUG_LENGTH)
  slug?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'https://example.org',
  })
  @IsOptional()
  // `require_protocol` because phase 0 learned that `IsUrl` alone accepts a
  // bare word, which then renders as a broken link.
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  websiteUrl?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsEmail()
  contactEmail?: string | null;

  @ApiProperty({
    required: false,
    enum: EVENT_SERIES_STATUSES as string[],
    description: 'Defaults to draft, so a series can be prepared unseen.',
  })
  @IsOptional()
  @IsIn(EVENT_SERIES_STATUSES as string[])
  status?: EventSeriesStatus;
}

/** Every field optional; only what is sent gets written. */
export class UpdateEventSeriesDto extends PartialType(CreateEventSeriesDto) {}
