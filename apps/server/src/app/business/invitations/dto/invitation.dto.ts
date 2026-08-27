import { ApiProperty } from '@nestjs/swagger';
import type {
  ContactOptOutResult,
  Invitation,
  InvitationPage,
  InvitationState,
  SeriesContact,
  SeriesContactPage,
} from '@trefaro/shared-models';

/**
 * OpenAPI shapes of the invitation endpoints (FR 2.4, F24).
 *
 * Each class `implements` its interface from `@trefaro/shared-models`, so the
 * documented API and the types both clients compile against cannot drift apart.
 */
export class SeriesContactDto implements SeriesContact {
  @ApiProperty({
    format: 'uuid',
    description:
      'The most recent confirmed registration of this address in the series. ' +
      'What a selection names — this API takes no e-mail addresses (F55).',
  })
  registrationId!: string;

  @ApiProperty({ example: 'amina@example.org' })
  email!: string;

  @ApiProperty({ example: 'Amina' })
  firstName!: string;

  @ApiProperty({ example: 'Okonkwo' })
  lastName!: string;

  @ApiProperty({
    example: 2,
    description:
      'How many events of this series this address is confirmed for. Somebody ' +
      'who came three times appears once — they are one person.',
  })
  events!: number;

  @ApiProperty({ format: 'date-time' })
  lastRegisteredAt!: string;
}

export class SeriesContactPageDto implements SeriesContactPage {
  @ApiProperty({ type: [SeriesContactDto] })
  rows!: readonly SeriesContactDto[];

  @ApiProperty({
    description: 'Addresses matching the filter, not on the page.',
  })
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class InvitationDto implements Invitation {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  seriesId!: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
    description:
      'The event invited to, if the invitation named one. `null` afterwards if ' +
      'that event was deleted — the record of who was written to outlives it.',
  })
  eventId!: string | null;

  @ApiProperty({ example: 'You are invited: Democracy Days 2027' })
  subject!: string;

  @ApiProperty({ description: 'Plain text as the organizer wrote it.' })
  body!: string;

  @ApiProperty({
    enum: ['sending', 'sent', 'partial'],
    description:
      'Derived from the three counts, never stored: `sending` while anything ' +
      'is pending, `partial` when some address could not be reached.',
  })
  state!: InvitationState;

  @ApiProperty({ description: 'How many addresses the invitation names.' })
  recipients!: number;

  @ApiProperty()
  sent!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    type: String,
    description: 'Set once no recipient is pending any more.',
  })
  finishedAt!: string | null;
}

export class InvitationPageDto implements InvitationPage {
  @ApiProperty({ type: [InvitationDto] })
  rows!: readonly InvitationDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class ContactOptOutResultDto implements ContactOptOutResult {
  @ApiProperty({
    enum: ['opted-out', 'already-opted-out'],
    description:
      'Says nothing about who or which series: the answer to "leave me alone" ' +
      'is never a look into the participant list (E10, E15).',
  })
  state!: 'opted-out' | 'already-opted-out';
}
