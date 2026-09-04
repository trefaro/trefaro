import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  NewsletterAudiencePage,
  NewsletterConsent,
  NewsletterCounts,
  NewsletterSource,
} from '@trefaro/shared-models';
import {
  DEFAULT_NEWSLETTER_PAGE_SIZE,
  MAX_NEWSLETTER_PAGE_SIZE,
} from '@trefaro/shared-models';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * The query string of the overview (FR 4.8).
 *
 * Paging and the language, and nothing else. No filter by source: the column
 * says which source a row is, and a filter would be a second way to ask a
 * question the list already answers on every line. No search either — this
 * list is read to be counted and exported, not to look somebody up; the
 * participant overview is where an organizer looks for a person.
 */
export class ListNewsletterDto {
  /** Declared so `forbidNonWhitelisted` lets `?locale=` through (F94). */
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
    maximum: MAX_NEWSLETTER_PAGE_SIZE,
    default: DEFAULT_NEWSLETTER_PAGE_SIZE,
    description: `Capped at ${MAX_NEWSLETTER_PAGE_SIZE} by the service.`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class NewsletterConsentDto implements NewsletterConsent {
  @ApiProperty({ example: 'amina@example.org' })
  email!: string;

  @ApiProperty({
    enum: ['form', 'app'],
    description:
      '`form` is the checkbox in a registration form, `app` the sign-up of ' +
      'FR 4.8. The one thing this list exists to say (E45).',
  })
  source!: NewsletterSource;

  @ApiProperty({ example: '2026-09-04T09:12:00.000Z' })
  confirmedAt!: string;

  @ApiProperty({ nullable: true, description: '`null` is the whole instance.' })
  seriesId!: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'The series’ name in the language asked for, or `null` for a consent ' +
      'that is about the instance rather than one series.',
  })
  seriesName!: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'The handle for taking this consent back — only the app source has ' +
      'one. A form consent is part of a registration and is administered there.',
  })
  subscriptionId!: string | null;
}

export class NewsletterCountsDto implements NewsletterCounts {
  @ApiProperty({ description: 'Consents, both sources together.' })
  total!: number;

  @ApiProperty()
  fromForm!: number;

  @ApiProperty()
  fromApp!: number;

  @ApiProperty({
    description:
      'Distinct addresses — smaller than `total` exactly when somebody said ' +
      'yes in both places.',
  })
  addresses!: number;
}

export class NewsletterAudiencePageDto implements NewsletterAudiencePage {
  @ApiProperty({ type: [NewsletterConsentDto] })
  rows!: readonly NewsletterConsentDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty({ default: DEFAULT_NEWSLETTER_PAGE_SIZE })
  pageSize!: number;

  @ApiProperty({ type: NewsletterCountsDto })
  counts!: NewsletterCountsDto;
}
