import { ApiPropertyOptional } from '@nestjs/swagger';
import type { ContactQuery, InvitationQuery } from '@trefaro/shared-models';
import {
  DEFAULT_CONTACT_PAGE_SIZE,
  DEFAULT_INVITATION_PAGE_SIZE,
  MAX_CONTACT_PAGE_SIZE,
  MAX_INVITATION_PAGE_SIZE,
} from '@trefaro/shared-models';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Long enough for a full name and an address, short enough to stay a filter. */
const MAX_SEARCH_LENGTH = 200;

/**
 * The query string of the contact list (FR 2.4).
 *
 * No sort parameter: the list is always newest registration first, because
 * "who has been with us most recently" is the question somebody picking an
 * audience is asking. Numbers arrive as strings in a query string, hence
 * `@Type(() => Number)`; the service clamps what survives validation.
 */
export class ListContactsDto implements ContactQuery {
  @ApiPropertyOptional({
    description:
      'Free text over first name, last name and address. Every word has to ' +
      'match one of the three.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'One-based.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_CONTACT_PAGE_SIZE,
    default: DEFAULT_CONTACT_PAGE_SIZE,
    description:
      `Capped at ${MAX_CONTACT_PAGE_SIZE} by the service — large enough that ` +
      'the audience of a two-hundred-person invitation can be selected on one ' +
      'page, because a selection assembled across nine pages is one an ' +
      'organizer gets wrong.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

/** The query string of the log of what has been sent. */
export class ListInvitationsDto implements InvitationQuery {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'One-based.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_INVITATION_PAGE_SIZE,
    default: DEFAULT_INVITATION_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
