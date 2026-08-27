import { ApiProperty } from '@nestjs/swagger';
import type {
  RegistrationStatus,
  RegistrationStatusChange,
} from '@trefaro/shared-models';
import { REGISTRATION_STATUSES } from '@trefaro/shared-models';
import { IsIn } from 'class-validator';

/**
 * What an organizer changes about a registration (E14).
 *
 * Only the status, and not every transition: cancelling is always allowed,
 * reinstating restores a confirmation the participant themselves gave, and
 * setting `confirmed` on an address that was never confirmed is refused — the
 * double opt-in is this application's consent record (E5, F23).
 */
export class UpdateRegistrationDto implements RegistrationStatusChange {
  @ApiProperty({
    enum: REGISTRATION_STATUSES,
    description:
      '`cancelled` from any state; `confirmed` only for a registration that ' +
      'was confirmed at some point; `pending` only back from `cancelled`.',
  })
  @IsIn(REGISTRATION_STATUSES)
  status!: RegistrationStatus;
}
