import { ApiProperty } from '@nestjs/swagger';
import type {
  ProgramItemLoad,
  ProgramItemSignup,
} from '@trefaro/shared-models';

/**
 * One person's seat, as the organizer's load view lists it (FR 3.10).
 *
 * The address is in the row rather than one click away — the single correction
 * the usability test of the thesis produced, and it applies to every table an
 * organizer reads participants from.
 */
export class ProgramItemParticipantDto implements ProgramItemSignup {
  @ApiProperty({ format: 'uuid' })
  registrationId!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ format: 'date-time' })
  signedUpAt!: string;
}

/** Take-up of one session: the numbers, and who they are (FR 3.10). */
export class ProgramItemLoadDto implements ProgramItemLoad {
  @ApiProperty({ format: 'uuid' })
  itemId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  registrationEnabled!: boolean;

  @ApiProperty({ required: false, nullable: true, type: Number })
  capacity!: number | null;

  @ApiProperty()
  signupCount!: number;

  @ApiProperty({ type: [ProgramItemParticipantDto] })
  participants!: ProgramItemParticipantDto[];
}
