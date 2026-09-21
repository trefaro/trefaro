import { ApiProperty } from '@nestjs/swagger';
import type { AdminPasswordChange } from '@trefaro/shared-models';
import { IsString, Length } from 'class-validator';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../../common/password-policy';

/**
 * What the organizer's own account page sends (AP 9 of phase 5).
 *
 * The same two fields as the participant's `ChangePasswordDto` and a second
 * class rather than a shared one, for the reason the two accounts have two
 * tables and two cookies (E33, E34): one DTO reachable from both sides is the
 * first step towards one endpoint reachable from both sides.
 */
export class ChangeAdminPasswordDto implements AdminPasswordChange {
  @ApiProperty({ description: 'Verified against the stored hash.' })
  @IsString()
  @Length(1, MAX_PASSWORD_LENGTH)
  currentPassword!: string;

  @ApiProperty({
    minLength: MIN_PASSWORD_LENGTH,
    description:
      'Length only, no character classes — a long passphrase is stronger and ' +
      'easier to remember than "Passwort1!" (NFR 4).',
  })
  @IsString()
  @Length(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH)
  newPassword!: string;
}
