import { ApiProperty } from '@nestjs/swagger';
import type {
  SetupResult,
  SetupState,
  SetupSubmission,
} from '@trefaro/shared-models';
import {
  HEX_COLOR_PATTERN,
  MAX_LOCALE_TAG_LENGTH,
  MAX_ORGANIZATION_NAME_LENGTH,
} from '@trefaro/shared-models';
import { Type } from 'class-transformer';
import {
  IsString,
  Length,
  Matches,
  ValidateNested,
  IsDefined,
} from 'class-validator';
import { CreateAdminDto } from '../../login/dto/create-admin.dto';

/** Read-only: everything in it is derived from the environment or the row. */
export class SetupStateDto implements SetupState {
  @ApiProperty({ example: 'Trefaro' })
  organizationName!: string;

  @ApiProperty({ example: '#1f6f5c' })
  primaryColor!: string;

  @ApiProperty({ example: '#e8a33d' })
  accentColor!: string;

  @ApiProperty({ example: 'en' })
  defaultLocale!: string;

  @ApiProperty({
    example: ['en', 'de'],
    description:
      'The languages this image can be set to: the ones it ships mail ' +
      'templates for. An organization adds its own from AP 7 on.',
  })
  locales!: readonly string[];

  @ApiProperty({
    example: [
      'PUBLIC_ADMIN_CLIENT_URL is http://events.example.org: administrators cannot sign in over plain HTTP, because the session cookie is Secure.',
    ],
    description:
      'Findings about this deployment, identical to the warnings the server ' +
      'logs on startup. An instance with these runs — they are the values ' +
      'whose absence only shows up much later.',
  })
  warnings!: readonly string[];
}

/**
 * The first administrator, with exactly the rules every other account is held
 * to.
 *
 * Reuses the administration's own DTO rather than restating the password policy:
 * an account created here has to be defensible by the same measure as one
 * created later, and a second copy of "at least twelve characters" is the copy
 * that drifts.
 */
export class SetupAdminDto extends CreateAdminDto {}

export class CompleteSetupDto implements SetupSubmission {
  @ApiProperty({ type: SetupAdminDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => SetupAdminDto)
  admin!: SetupAdminDto;

  @ApiProperty({
    example: 'Democracy International e.V.',
    maxLength: MAX_ORGANIZATION_NAME_LENGTH,
  })
  @IsString()
  @Length(1, MAX_ORGANIZATION_NAME_LENGTH)
  organizationName!: string;

  @ApiProperty({
    example: 'de',
    maxLength: MAX_LOCALE_TAG_LENGTH,
    description:
      'One of the tags from `locales`. Decides the language of every outgoing ' +
      'mail and how dates are formatted; the value is checked against the ' +
      'shipped catalogue in the service as well.',
  })
  @IsString()
  @Length(2, MAX_LOCALE_TAG_LENGTH)
  defaultLocale!: string;

  @ApiProperty({ example: '#1f6f5c', pattern: HEX_COLOR_PATTERN.source })
  @IsString()
  @Matches(HEX_COLOR_PATTERN)
  primaryColor!: string;

  @ApiProperty({ example: '#e8a33d', pattern: HEX_COLOR_PATTERN.source })
  @IsString()
  @Matches(HEX_COLOR_PATTERN)
  accentColor!: string;
}

/** What the wizard shows on its last screen — deliberately not a session. */
export class SetupResultDto implements SetupResult {
  @ApiProperty({ example: 'organizer@example.org' })
  adminEmail!: string;

  @ApiProperty({ example: 'Democracy International e.V.' })
  organizationName!: string;
}
