import { ApiProperty } from '@nestjs/swagger';
import type {
  PasswordReset,
  PasswordResetAcknowledgement,
  PasswordResetRequest,
} from '@trefaro/shared-models';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../../common/password-policy';

export class RequestPasswordResetDto implements PasswordResetRequest {
  @ApiProperty({ example: 'amina@example.org' })
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class PasswordResetAcknowledgementDto implements PasswordResetAcknowledgement {
  @ApiProperty({
    example: 'amina@example.org',
    description:
      'The address as it was read — the same answer whether it has an ' +
      'account, has an unconfirmed one, or has none at all (E10, E32).',
  })
  email!: string;
}

export class ResetPasswordDto implements PasswordReset {
  @ApiProperty({
    description:
      'The `token` query parameter of the mailed link. In the body rather ' +
      'than the query because this request *changes* something (F44): a link ' +
      'previewer fetching an address must not be able to set a password.',
  })
  @IsString()
  @Length(1, 1024)
  token!: string;

  @ApiProperty({
    minLength: MIN_PASSWORD_LENGTH,
    description: 'The new password, held to the same policy as every other.',
  })
  @IsString()
  @Length(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH)
  password!: string;
}
