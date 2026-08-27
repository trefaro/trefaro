import { ApiPropertyOptional } from '@nestjs/swagger';
import type {
  ParticipantQuery,
  ParticipantSort,
  RegistrationStatus,
  SortDirection,
} from '@trefaro/shared-models';
import {
  MAX_PARTICIPANT_PAGE_SIZE,
  PARTICIPANT_SORTS,
  REGISTRATION_STATUSES,
} from '@trefaro/shared-models';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** Long enough for a full name and an address, short enough to stay a filter. */
const MAX_SEARCH_LENGTH = 200;

/**
 * The query string of the participant table (FR 3.3).
 *
 * Numbers arrive as strings in a query string, hence `@Type(() => Number)` — the
 * global validation pipe transforms but does not guess types implicitly. The
 * service clamps what survives validation: this class rejects nonsense, it does
 * not decide policy.
 */
export class ListParticipantsDto implements ParticipantQuery {
  @ApiPropertyOptional({
    description:
      'Free text over first name, last name and e-mail. Every word has to ' +
      'match one of the three, so "okonkwo amina" finds the same person as ' +
      '"amina okonkwo".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
  search?: string;

  @ApiPropertyOptional({ enum: REGISTRATION_STATUSES })
  @IsOptional()
  @IsIn(REGISTRATION_STATUSES)
  status?: RegistrationStatus;

  @ApiPropertyOptional({ enum: PARTICIPANT_SORTS, default: 'registeredAt' })
  @IsOptional()
  @IsIn(PARTICIPANT_SORTS)
  sort?: ParticipantSort;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  direction?: SortDirection;

  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'One-based.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PARTICIPANT_PAGE_SIZE,
    default: 25,
    description: `Capped at ${MAX_PARTICIPANT_PAGE_SIZE} by the service.`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
