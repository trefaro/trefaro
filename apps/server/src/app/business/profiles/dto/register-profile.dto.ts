import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ProfileRegistrationRequest } from '@trefaro/shared-models';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../../common/password-policy';

export class RegisterProfileDto implements ProfileRegistrationRequest {
  @ApiProperty({ example: 'amina@example.org' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({
    minLength: MIN_PASSWORD_LENGTH,
    description:
      'Length only, no character classes — a long passphrase is stronger and ' +
      'easier to remember than "Passwort1!" (NFR 4).',
  })
  @IsString()
  @Length(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH)
  password!: string;

  @ApiProperty({ example: 'Amina' })
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiProperty({ example: 'Okonkwo' })
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @ApiPropertyOptional({
    example: 'de',
    description:
      'BCP 47 tag: the language the form was filled in, so the confirmation ' +
      'mail arrives in it. Omitted means the instance’s default language.',
  })
  @IsOptional()
  @IsString()
  @Length(2, 16)
  preferredLocale?: string;
}

export class ConfirmProfileDto {
  @ApiProperty({
    description: 'The `token` query parameter of the mailed link.',
  })
  @IsString()
  @Length(1, 1024)
  token!: string;
}
