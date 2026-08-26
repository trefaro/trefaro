import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import {
  MAX_ADMIN_PASSWORD_LENGTH,
  MIN_ADMIN_PASSWORD_LENGTH,
} from '../password-policy';

export class CreateAdminDto {
  @ApiProperty({ example: 'organizer@example.org' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ example: 'Alex Weber' })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({
    minLength: MIN_ADMIN_PASSWORD_LENGTH,
    description:
      'Length only, no character classes: a long passphrase beats a short ' +
      'password with a symbol in it, and is easier for the people this is for.',
  })
  @IsString()
  @Length(MIN_ADMIN_PASSWORD_LENGTH, MAX_ADMIN_PASSWORD_LENGTH)
  password!: string;
}
