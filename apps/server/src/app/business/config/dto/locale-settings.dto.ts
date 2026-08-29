import { ApiProperty } from '@nestjs/swagger';
import type { LocaleSettings } from '@trefaro/shared-models';
import {
  MAX_ACTIVE_LOCALES,
  MAX_LOCALE_TAG_LENGTH,
} from '@trefaro/shared-models';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

/**
 * Which languages the instance offers, and which one it defaults to (AP 7).
 *
 * Read and written as a pair, because the two constrain each other: the default
 * has to be one of the offered ones, and English is always among them (NFR 4).
 * The tags themselves are checked in `ConfigurationService` — one pattern, in
 * `shared-models`, shared with the public catalogue endpoint, so a tag that is
 * accepted in one place cannot be refused in the other.
 */
export class LocaleSettingsDto implements LocaleSettings {
  @ApiProperty({
    example: 'de',
    maxLength: MAX_LOCALE_TAG_LENGTH,
    description:
      'The language a first-time visitor sees and every mail goes out in. ' +
      'Must be one of `activeLocales`.',
  })
  @IsString()
  defaultLocale!: string;

  @ApiProperty({
    isArray: true,
    type: String,
    example: ['en', 'de', 'fr'],
    maxItems: MAX_ACTIVE_LOCALES,
    description:
      'Offered in the language switcher of both clients, in this order. ' +
      'English is added if it is left out — it is the last link of the ' +
      'resolution chain (E23). A language may be offered while barely ' +
      'translated: a client falls back per key. Removing one deletes no ' +
      'translation (E30).',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ACTIVE_LOCALES)
  @IsString({ each: true })
  activeLocales!: string[];
}
