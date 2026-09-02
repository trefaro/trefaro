import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  CustomFieldValues,
  ProfileSearchHit,
  ProfileSearchPage,
  ProfileSearchQuery,
  PublicProfile,
} from '@trefaro/shared-models';
import {
  DEFAULT_PROFILE_SEARCH_PAGE_SIZE,
  MAX_PROFILE_SEARCH_PAGE_SIZE,
} from '@trefaro/shared-models';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * The longest thing either search box may send.
 *
 * Generous rather than exact: the point of a bound here is that a request
 * cannot carry a megabyte of text into an `ILIKE`, not that a search term is
 * plausible. The word cap in `searchTerms` does the rest of that work.
 */
const MAX_SEARCH_LENGTH = 200;

/**
 * The query string of the participant search (FR 4.4).
 *
 * No `locale` here, unlike the list of one's own registrations: nothing in this
 * answer is translated. A name is a name, the field of activity is what
 * somebody typed about themselves, and the labels of the profile questions come
 * from `GET /api/participant/profile-fields`. `forbidNonWhitelisted` therefore
 * refuses a `?locale=` on this endpoint — which is correct rather than
 * unfortunate: a parameter that changed nothing would be a promise that it
 * does.
 *
 * Numbers arrive as strings in a query string, hence `@Type(() => Number)`.
 */
export class SearchProfilesDto implements ProfileSearchQuery {
  @ApiPropertyOptional({
    maxLength: MAX_SEARCH_LENGTH,
    example: 'amina okonkwo',
    description:
      'Words that all have to appear, in the name **or** the field of ' +
      'activity — so the two halves of a name may be typed in either order ' +
      '(F32, F126). At most five words are used.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
  search?: string;

  @ApiPropertyOptional({
    maxLength: MAX_SEARCH_LENGTH,
    example: 'election observation',
    description:
      'Words that all have to appear in the field of activity alone (E36) — ' +
      'how somebody looks for a person they do not know yet.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
  activityAreas?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'One-based.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PROFILE_SEARCH_PAGE_SIZE,
    default: DEFAULT_PROFILE_SEARCH_PAGE_SIZE,
    description: `Capped at ${MAX_PROFILE_SEARCH_PAGE_SIZE} by the service.`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

/**
 * One hit of the search.
 *
 * What a row needs to be read and opened, and nothing else. The address is
 * absent by design: a participant writes to another participant through a
 * conversation (FR 4.5), never to a mailbox this answer handed them (F55).
 */
export class ProfileSearchHitDto implements ProfileSearchHit {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Amina' })
  firstName!: string;

  @ApiProperty({ example: 'Okonkwo' })
  lastName!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '/api/media/profiles/6f1c…/avatar?v=1787790600000',
    description:
      'Public URL of the picture, or `null`. Safe to hand out **because** ' +
      'this row exists only for a profile that opted in: whoever holds an id ' +
      'holds the picture with it (F124).',
  })
  avatarUrl!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Citizens’ assemblies, election observation',
  })
  activityAreas!: string | null;
}

/** A profile as another participant sees it: the row plus the answers (E35). */
export class PublicProfileDto
  extends ProfileSearchHitDto
  implements PublicProfile
{
  @ApiProperty({
    type: 'object',
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'boolean' }] },
    example: { 'local-group': 'Cologne' },
    description:
      'The answers this person gave to the instance’s profile questions, by ' +
      'field key. The labels come from `/api/participant/profile-fields`; an ' +
      'answer whose question was deleted keeps its key (F34).',
  })
  customFields!: CustomFieldValues;
}

export class ProfileSearchPageDto implements ProfileSearchPage {
  @ApiProperty({ type: [ProfileSearchHitDto] })
  rows!: ProfileSearchHitDto[];

  @ApiProperty({ description: 'What the pages divide, not this page’s size.' })
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
