import { ApiProperty } from '@nestjs/swagger';
import type {
  CustomFieldValues,
  MyProgramItem,
  MyRegistration,
  RegistrationStatus,
} from '@trefaro/shared-models';
import { PublicEventDto } from '../../events/dto/event.dto';
import { PublicProgramItemDto } from '../../program/dto/program-item.dto';

/** One session, plus whether this participant holds a seat in it (FR 3.10). */
export class MyProgramItemDto
  extends PublicProgramItemDto
  implements MyProgramItem
{
  @ApiProperty({ description: 'Whether this participant has claimed a seat.' })
  signedUp!: boolean;
}

/**
 * The participant's own registration (E11).
 *
 * Their own and nothing else: no other participant, no attendee list, not even
 * a count of who took which seat beyond the numbers the public programme already
 * carries. A link that reached the wrong inbox must not become a view of the
 * event's participants.
 */
export class MyRegistrationDto implements MyRegistration {
  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ enum: ['pending', 'confirmed', 'cancelled'] })
  status!: RegistrationStatus;

  @ApiProperty({ format: 'date-time' })
  registeredAt!: string;

  @ApiProperty({ format: 'date-time', required: false, nullable: true })
  confirmedAt!: string | null;

  @ApiProperty({
    description: 'The answers this participant gave to the event’s questions.',
    additionalProperties: true,
  })
  customFields!: CustomFieldValues;

  @ApiProperty()
  seriesSlug!: string;

  @ApiProperty({
    type: PublicEventDto,
    description:
      'The event, in the participant’s shape — answered even when the event ' +
      'went back to being a draft, because the link was granted before that.',
  })
  event!: PublicEventDto;

  @ApiProperty({ type: [MyProgramItemDto] })
  program!: MyProgramItemDto[];
}
