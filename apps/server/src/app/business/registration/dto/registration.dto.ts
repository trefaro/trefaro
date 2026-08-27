import { ApiProperty } from '@nestjs/swagger';
import type {
  ConfirmationState,
  RegistrationAcknowledgement,
  RegistrationConfirmation,
} from '@trefaro/shared-models';

/**
 * OpenAPI shapes for the participant side of registration.
 *
 * Each class `implements` the interface from `@trefaro/shared-models`, so the
 * documented API and the types the client compiles against cannot drift apart.
 */
export class RegistrationAcknowledgementDto implements RegistrationAcknowledgement {
  @ApiProperty({
    example: 'amina@example.org',
    description:
      'The address the confirmation went to. Deliberately the whole answer: ' +
      'whether this address was already registered is not disclosed (E10).',
  })
  email!: string;
}

export class RegistrationConfirmationDto implements RegistrationConfirmation {
  @ApiProperty({
    enum: ['confirmed', 'already-confirmed'],
    description:
      '`already-confirmed` when the link was followed a second time — that is ' +
      'a success, not an error (E5b).',
  })
  state!: ConfirmationState;

  @ApiProperty({ example: 'Kickoff in Cologne' })
  eventName!: string;

  @ApiProperty({
    description: 'Both slugs, so the page can link to the event.',
  })
  seriesSlug!: string;

  @ApiProperty()
  eventSlug!: string;
}
