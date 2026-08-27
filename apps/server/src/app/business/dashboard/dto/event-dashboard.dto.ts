import { ApiProperty } from '@nestjs/swagger';
import type {
  EventDashboard,
  MediaLinkSummary,
  ProgramSummary,
  RegistrationFormSummary,
} from '@trefaro/shared-models';
import { OrganizerEventDto } from '../../events/dto/event.dto';
import {
  ParticipantRowDto,
  RegistrationCountsDto,
} from '../../registration/dto/participant.dto';

/**
 * OpenAPI shape of the event dashboard (FR 3.8).
 *
 * Composed of the shapes the owning modules already document rather than of
 * copies of them: a dashboard that described a participant row in its own words
 * would be a second definition of the same row, free to drift.
 */
export class ProgramSummaryDto implements ProgramSummary {
  @ApiProperty({ description: 'Sessions in the programme.' })
  items!: number;

  @ApiProperty({
    description: 'Of those, how many ask who is coming (FR 3.10).',
  })
  withSignup!: number;

  @ApiProperty({ description: 'Seats claimed across the whole programme.' })
  signups!: number;
}

export class RegistrationFormSummaryDto implements RegistrationFormSummary {
  @ApiProperty({
    description: 'Questions beyond the standard fields (F12).',
  })
  questions!: number;

  @ApiProperty()
  required!: number;
}

export class MediaLinkSummaryDto implements MediaLinkSummary {
  @ApiProperty({ description: 'External links of this event (FR 3.6, F10).' })
  links!: number;

  @ApiProperty()
  streams!: number;

  @ApiProperty()
  recordings!: number;

  @ApiProperty()
  materials!: number;
}

export class EventDashboardDto implements EventDashboard {
  @ApiProperty({ type: OrganizerEventDto })
  event!: OrganizerEventDto;

  @ApiProperty({
    example: 'democracy-days',
    description:
      'The series part of the public address — nested, because slugs are ' +
      'unique per parent rather than globally (E7, F28).',
  })
  seriesSlug!: string;

  @ApiProperty({ type: RegistrationCountsDto })
  registrations!: RegistrationCountsDto;

  @ApiProperty({
    type: [ParticipantRowDto],
    description:
      'Newest first, at most five. With the e-mail address in the row, like ' +
      'every other table an organizer reads (E13).',
  })
  latestRegistrations!: ParticipantRowDto[];

  @ApiProperty({ type: ProgramSummaryDto })
  program!: ProgramSummaryDto;

  @ApiProperty({ type: RegistrationFormSummaryDto })
  form!: RegistrationFormSummaryDto;

  @ApiProperty({
    type: MediaLinkSummaryDto,
    nullable: true,
    description:
      '`null` when the organization has switched `media-links` off (FR 1.5): ' +
      'its endpoints then answer 404 (F53), so a tile leading there would be a ' +
      'dead end drawn as a feature.',
  })
  mediaLinks!: MediaLinkSummaryDto | null;
}
