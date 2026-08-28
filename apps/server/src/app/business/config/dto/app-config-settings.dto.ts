import { ApiProperty, PartialType } from '@nestjs/swagger';
import type {
  AppConfigChange,
  AppConfigSettings,
} from '@trefaro/shared-models';
import {
  FONT_FAMILY_KEYS,
  HEX_COLOR_PATTERN,
  MAX_ORGANIZATION_NAME_LENGTH,
} from '@trefaro/shared-models';
import { IsIn, IsString, Length, Matches } from 'class-validator';

/**
 * The whitelabel settings as they are read and written (FR 1.4).
 *
 * The class doubles as the OpenAPI response and, through {@link PartialType},
 * as the `PATCH` body — the same bounds either way, so a value that passes
 * cannot fail in the database.
 *
 * Both rules are enforced in `ConfigurationService` as well. A DTO is the outer
 * wall: a seed script or a later import would reach the service directly.
 */
export class AppConfigSettingsDto implements AppConfigSettings {
  @ApiProperty({
    example: 'Democracy International e.V.',
    maxLength: MAX_ORGANIZATION_NAME_LENGTH,
    description:
      'What the instance calls itself — in page titles, mails and the PWA ' +
      'manifest. Trimmed before it is stored.',
  })
  @IsString()
  @Length(1, MAX_ORGANIZATION_NAME_LENGTH)
  organizationName!: string;

  @ApiProperty({
    example: '#1f6f5c',
    pattern: HEX_COLOR_PATTERN.source,
    description:
      'Hexadecimal only, `#rgb` or `#rrggbb`, no alpha (E17): the clients ' +
      'derive the readable text colour from this value, and anything they ' +
      'cannot parse silently becomes white text.',
  })
  @IsString()
  @Matches(HEX_COLOR_PATTERN)
  primaryColor!: string;

  @ApiProperty({ example: '#e8a33d', pattern: HEX_COLOR_PATTERN.source })
  @IsString()
  @Matches(HEX_COLOR_PATTERN)
  accentColor!: string;

  @ApiProperty({
    enum: FONT_FAMILY_KEYS as string[],
    example: 'inter',
    description:
      'A key of the bundled font catalogue, not a CSS stack. The instance ' +
      'serves these files itself; there is no upload and no CDN (E18, NFR 9).',
  })
  @IsIn(FONT_FAMILY_KEYS as string[])
  fontFamily!: string;
}

/** Every field optional; only what is sent gets written. */
export class UpdateAppConfigDto
  extends PartialType(AppConfigSettingsDto)
  implements AppConfigChange {}
