import { ApiProperty } from '@nestjs/swagger';
import type {
  EventSeriesTranslation,
  EventSeriesTranslations,
  EventTranslation,
  EventTranslations,
  ProgramItemTranslation,
  ProgramItemTranslations,
  TranslatedText,
  TranslationsByLocale,
} from '@trefaro/shared-models';
import {
  MAX_CONTENT_DESCRIPTION_LENGTH,
  MAX_CONTENT_NAME_LENGTH,
  MAX_FOLLOW_UP_LENGTH,
  MAX_PROGRAM_DESCRIPTION_LENGTH,
  MAX_PROGRAM_TITLE_LENGTH,
  MAX_VENUE_NAME_LENGTH,
} from '@trefaro/shared-models';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * OpenAPI and validation for content translations (FR 3.12).
 *
 * Every field is optional and nullable, in both directions. Sending nothing for
 * a field and sending `null` for it mean the same thing — "no translation, use
 * the original" — because the write replaces the whole translation of one thing
 * and a translator who clears a box has to be able to say so.
 *
 * The bounds are the originals' bounds, imported rather than repeated: a
 * translation that could be longer than what it translates would fit in no
 * layout the original fits in.
 */

/** `null` in a response, absent or `null` in a request. */
const TRANSLATED = {
  required: false,
  nullable: true,
  type: String,
} as const;

export class EventSeriesTranslationDto implements EventSeriesTranslation {
  @ApiProperty(TRANSLATED)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTENT_NAME_LENGTH)
  name!: TranslatedText;

  @ApiProperty(TRANSLATED)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTENT_DESCRIPTION_LENGTH)
  description!: TranslatedText;
}

export class EventTranslationDto implements EventTranslation {
  @ApiProperty(TRANSLATED)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTENT_NAME_LENGTH)
  name!: TranslatedText;

  @ApiProperty(TRANSLATED)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTENT_DESCRIPTION_LENGTH)
  description!: TranslatedText;

  @ApiProperty({
    ...TRANSLATED,
    description:
      'The name of the place. `venueAddress` has no translation: a street is ' +
      'the same street in every language, and a translated one sends people to ' +
      'a place that does not exist (E25).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_VENUE_NAME_LENGTH)
  venueName!: TranslatedText;

  @ApiProperty(TRANSLATED)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_FOLLOW_UP_LENGTH)
  followUpBody!: TranslatedText;
}

export class ProgramItemTranslationDto implements ProgramItemTranslation {
  @ApiProperty(TRANSLATED)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PROGRAM_TITLE_LENGTH)
  title!: TranslatedText;

  @ApiProperty({
    ...TRANSLATED,
    description:
      '`speaker` has no translation — a person’s name is what they are called.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PROGRAM_DESCRIPTION_LENGTH)
  description!: TranslatedText;
}

export class EventSeriesTranslationsDto implements EventSeriesTranslations {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    type: EventSeriesTranslationDto,
    description:
      'What the organizer wrote — what a translator translates from.',
  })
  source!: EventSeriesTranslation;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'object' },
    description:
      'By language tag; only languages that have a translation appear.',
  })
  translations!: TranslationsByLocale<EventSeriesTranslation>;
}

export class ProgramItemTranslationsDto implements ProgramItemTranslations {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    format: 'date-time',
    description:
      'So a translator can tell two sessions of one name apart. Rendered in ' +
      'the event’s zone (E8), which the event carries.',
  })
  startsAt!: string;

  @ApiProperty({ type: ProgramItemTranslationDto })
  source!: ProgramItemTranslation;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'object' } })
  translations!: TranslationsByLocale<ProgramItemTranslation>;
}

export class EventTranslationsDto implements EventTranslations {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Europe/Berlin' })
  timezone!: string;

  @ApiProperty({ type: EventTranslationDto })
  source!: EventTranslation;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'object' } })
  translations!: TranslationsByLocale<EventTranslation>;

  @ApiProperty({
    type: [ProgramItemTranslationsDto],
    description:
      'The whole programme, in the order it happens — one screen, one request ' +
      '(F49). The writes stay one per session, so a mistake in the nineteenth ' +
      'does not throw away the third.',
  })
  programItems!: readonly ProgramItemTranslations[];
}
