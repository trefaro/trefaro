import { ApiProperty } from '@nestjs/swagger';
import type { AdminLoginRequest } from '@trefaro/shared-models';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { MAX_ADMIN_PASSWORD_LENGTH } from '../password-policy';

export class AdminLoginDto implements AdminLoginRequest {
  @ApiProperty({ example: 'organizer@example.org' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({
    description:
      'No minimum is enforced here — an existing password must keep working. ' +
      'The upper bound keeps a request from making the server hash megabytes.',
  })
  @IsString()
  @Length(1, MAX_ADMIN_PASSWORD_LENGTH)
  password!: string;
}
