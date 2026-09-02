import { ApiProperty } from '@nestjs/swagger';
import type { ParticipantLoginRequest } from '@trefaro/shared-models';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { MAX_PASSWORD_LENGTH } from '../../common/password-policy';

export class ParticipantLoginDto implements ParticipantLoginRequest {
  @ApiProperty({ example: 'amina@example.org' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({
    description:
      'No minimum is enforced here — an existing password must keep working. ' +
      'The upper bound keeps a request from making the server hash megabytes.',
  })
  @IsString()
  @Length(1, MAX_PASSWORD_LENGTH)
  password!: string;
}
