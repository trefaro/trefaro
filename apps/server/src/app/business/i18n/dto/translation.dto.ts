import { ApiProperty } from '@nestjs/swagger';
import type {
  LocaleCatalogueDetail,
  LocaleOverview,
  LocaleSummary,
  TranslationEntry,
  TranslationState,
  TranslationWrite,
  TranslationWriteResult,
} from '@trefaro/shared-models';
import { IsObject } from 'class-validator';

/** One language in the list of languages (AP 7). */
export class LocaleSummaryDto implements LocaleSummary {
  @ApiProperty({ example: 'de', description: 'Lower-cased BCP 47 tag.' })
  locale!: string;

  @ApiProperty({
    description: 'This image ships a catalogue file for the language.',
  })
  shipped!: boolean;

  @ApiProperty({
    description:
      'The language is offered in both clients (`app_config.active_locales`). ' +
      'Independent of `shipped` and of any translation: a language exists ' +
      'because somebody translated it, offering it is a separate decision.',
  })
  active!: boolean;

  @ApiProperty({
    description: 'Language of a first-time visitor and of outgoing mail.',
  })
  isDefault!: boolean;

  @ApiProperty({
    example: 5,
    description: 'Keys in the shipped English catalogue — English is the list.',
  })
  total!: number;

  @ApiProperty({
    example: 5,
    description: 'Keys this language has a text of its own for.',
  })
  translated!: number;

  @ApiProperty({
    example: 1,
    description: 'Rows the organization wrote; never more than `translated`.',
  })
  overrides!: number;
}

/** The list of languages plus the one value that is not per language. */
export class LocaleOverviewDto implements LocaleOverview {
  @ApiProperty({ example: 'en' })
  defaultLocale!: string;

  @ApiProperty({ type: LocaleSummaryDto, isArray: true })
  locales!: readonly LocaleSummaryDto[];
}

/** One key in one language, with everything the editor shows beside it. */
export class TranslationEntryDto implements TranslationEntry {
  @ApiProperty({ example: 'modules.push.title' })
  key!: string;

  @ApiProperty({
    example: 'Push notifications',
    description: 'The shipped English text: the original, and the last resort.',
  })
  english!: string;

  @ApiProperty({
    nullable: true,
    example: 'Push-Benachrichtigungen',
    description: 'What this image ships for the language, or `null`.',
  })
  shipped!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'What the organization wrote, or `null`.',
  })
  override!: string | null;

  @ApiProperty({
    description: 'What `GET /api/i18n/:locale` actually answers for this key.',
  })
  value!: string;

  @ApiProperty({
    enum: ['overridden', 'shipped', 'missing'],
    description:
      '`missing` means a client receives the English text for this key (E23) ' +
      '— usable rather than blank, and counted against the figure.',
  })
  state!: TranslationState;
}

/** One language with every key — the editor's payload. */
export class LocaleCatalogueDetailDto
  extends LocaleSummaryDto
  implements LocaleCatalogueDetail
{
  @ApiProperty({ type: TranslationEntryDto, isArray: true })
  entries!: readonly TranslationEntryDto[];
}

/**
 * The body of a write: keys to values.
 *
 * A map rather than a list of objects, because that is the shape of the
 * catalogue itself — so an export can be edited in a text editor and sent back
 * unchanged. The keys and values are checked in the service rather than here:
 * a `Record` has no properties for class-validator to decorate, and the rules
 * (a key this image has, a value within the column's bound, an empty value
 * meaning reset) are product decisions that a seed script or a later import must
 * pass through as well.
 */
export class TranslationWriteDto implements TranslationWrite {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { 'modules.push.title': 'Push-Mitteilungen' },
    description:
      'One entry per key. An empty value removes the organization’s text and ' +
      'falls back to what the image ships, which is what makes an ' +
      'export/import round trip work: an untranslated key is an empty string.',
  })
  @IsObject()
  entries!: Record<string, string>;
}

/** What a write changed (AP 7). */
export class TranslationWriteResultDto implements TranslationWriteResult {
  @ApiProperty({ example: 'de' })
  locale!: string;

  @ApiProperty({ description: 'Keys whose stored text now differs.' })
  written!: number;

  @ApiProperty({ description: 'Keys whose stored row was removed.' })
  reset!: number;

  @ApiProperty({ description: 'Keys that already stood exactly so.' })
  unchanged!: number;

  @ApiProperty({
    isArray: true,
    type: String,
    description:
      'Keys this image does not have — named rather than silently dropped. A ' +
      'file from an older or newer image is the normal case for translation ' +
      'work, so it is imported and the difference is reported.',
  })
  ignored!: readonly string[];

  @ApiProperty({ type: LocaleSummaryDto })
  summary!: LocaleSummaryDto;
}
