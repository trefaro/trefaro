import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  MyRegistrationPage,
  MyRegistrationSummary,
  RegistrationStatus,
} from '@trefaro/shared-models';
import {
  DEFAULT_MY_REGISTRATION_PAGE_SIZE,
  MAX_MY_REGISTRATION_PAGE_SIZE,
  REGISTRATION_STATUSES,
} from '@trefaro/shared-models';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PublicEventDto } from '../../events/dto/event.dto';

/**
 * The query string of "my registrations" (FR 4.7).
 *
 * Numbers arrive as strings in a query string, hence `@Type(() => Number)`.
 * There is no filter and no sort: this list is short by nature, and its order
 * is the one the reader wants — the next event first.
 */
export class ListMyRegistrationsDto {
  /**
   * Declared so the whitelist lets it through, not to be read here.
   *
   * `forbidNonWhitelisted` judges the **whole** query string against this
   * class, so an endpoint that takes a query object *and* `?locale=` has to
   * name the language here as well — otherwise the request is a 400 before any
   * handler sees it. The value itself is read through `LocaleQueryPipe`, which
   * owns the rule about what a language tag is (F94); this field exists only so
   * that pipe gets the chance.
   */
  @ApiPropertyOptional({
    description: 'See the shared locale query parameter.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(35)
  locale?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'One-based.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_MY_REGISTRATION_PAGE_SIZE,
    default: DEFAULT_MY_REGISTRATION_PAGE_SIZE,
    description: `Capped at ${MAX_MY_REGISTRATION_PAGE_SIZE} by the service.`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

/**
 * One row of the list — the event, the state, and the id that opens it.
 *
 * Neither the answers nor the programme travel here. A list that carried the
 * whole view per row would be one query per row on the server, and the row
 * exists to get somebody to the registration, not to be it.
 */
export class MyRegistrationSummaryDto implements MyRegistrationSummary {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: REGISTRATION_STATUSES })
  status!: RegistrationStatus;

  @ApiProperty({ format: 'date-time' })
  registeredAt!: string;

  @ApiProperty({ format: 'date-time', required: false, nullable: true })
  confirmedAt!: string | null;

  @ApiProperty({ description: 'For the link to the event’s public page.' })
  seriesSlug!: string;

  @ApiProperty({
    type: PublicEventDto,
    description:
      'Answered whatever the event’s status is: a registration is an ' +
      'obligation towards a person and does not become invisible because the ' +
      'event was unpublished.',
  })
  event!: PublicEventDto;
}

export class MyRegistrationPageDto implements MyRegistrationPage {
  @ApiProperty({ type: [MyRegistrationSummaryDto] })
  rows!: MyRegistrationSummaryDto[];

  @ApiProperty({ description: 'What the pages divide, not this page’s size.' })
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
