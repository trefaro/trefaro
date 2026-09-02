import { ApiProperty } from '@nestjs/swagger';
import type {
  AttachmentSummary,
  CustomFieldValues,
  ParticipantDetail,
  ParticipantPage,
  ParticipantRow,
  RegistrationCounts,
  RegistrationStatistics,
  RegistrationStatus,
  RegistrationWeek,
} from '@trefaro/shared-models';
import { REGISTRATION_STATUSES } from '@trefaro/shared-models';

/**
 * OpenAPI shapes of the participant overview (FR 3.3).
 *
 * Each class `implements` its interface from `@trefaro/shared-models`, so the
 * documented API and the types the organizer client compiles against cannot
 * drift apart.
 */
export class ParticipantRowDto implements ParticipantRow {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Amina' })
  firstName!: string;

  @ApiProperty({ example: 'Okonkwo' })
  lastName!: string;

  @ApiProperty({
    example: 'amina@example.org',
    description:
      'A field of the row, not something behind a click — the one correction ' +
      "the thesis' usability test produced.",
  })
  email!: string;

  @ApiProperty({ required: false, nullable: true })
  phone!: string | null;

  @ApiProperty({ required: false, nullable: true })
  origin!: string | null;

  @ApiProperty({ enum: REGISTRATION_STATUSES })
  status!: RegistrationStatus;

  @ApiProperty()
  newsletterOptIn!: boolean;

  @ApiProperty({
    description: 'The participant objected to being invited again (E15).',
  })
  contactOptOut!: boolean;

  @ApiProperty({
    description:
      'Whether this address has a confirmed participant account (FR 3.3, ' +
      'E31). A yes/no and nothing more: an id would hand out the profile ' +
      'picture with it (F124).',
  })
  hasProfile!: boolean;

  @ApiProperty({ example: '2026-08-24T09:30:00.000Z' })
  registeredAt!: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Kept after a cancellation: that somebody once confirmed is a fact, and ' +
      'it decides whether reinstating may restore `confirmed`.',
  })
  confirmedAt!: string | null;

  @ApiProperty({
    type: Object,
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'boolean' }] },
    example: { 'dietary-requirements': 'vegan' },
    description:
      'Answers to the configurable fields of this event (F12). May hold keys ' +
      'no field defines any more: deleting a definition does not delete what ' +
      'people wrote (F34).',
  })
  customFields!: CustomFieldValues;
}

export class RegistrationCountsDto implements RegistrationCounts {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  pending!: number;

  @ApiProperty()
  confirmed!: number;

  @ApiProperty()
  cancelled!: number;
}

export class ParticipantPageDto implements ParticipantPage {
  @ApiProperty({ type: [ParticipantRowDto] })
  rows!: ParticipantRowDto[];

  @ApiProperty({ description: 'Rows matching the filter.' })
  total!: number;

  @ApiProperty({ description: 'One-based.' })
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty({
    type: RegistrationCountsDto,
    description:
      'Of the whole event, unfiltered — so a filtered view can still say what ' +
      'it is a subset of.',
  })
  counts!: RegistrationCountsDto;
}

export class RegistrationWeekDto implements RegistrationWeek {
  @ApiProperty({
    example: '2026-08-24',
    description: "The Monday the week starts on, in the event's zone (E8).",
  })
  weekStart!: string;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  confirmed!: number;
}

export class RegistrationStatisticsDto implements RegistrationStatistics {
  @ApiProperty({
    type: [RegistrationWeekDto],
    description: 'Consecutive weeks, oldest first — quiet weeks included.',
  })
  weeks!: RegistrationWeekDto[];

  @ApiProperty({ type: RegistrationCountsDto })
  counts!: RegistrationCountsDto;

  @ApiProperty({ example: 'Europe/Berlin' })
  timezone!: string;
}

/** One file a participant uploaded (E9) — metadata only, never the bytes. */
export class AttachmentSummaryDto implements AttachmentSummary {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    example: 'passport-scan',
    description:
      'The field that asked for it — stable across a rewording (F35).',
  })
  fieldKey!: string;

  @ApiProperty({ example: 'passport.pdf' })
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 428_112 })
  sizeBytes!: number;

  @ApiProperty({ example: '2026-08-24T09:30:00.000Z' })
  uploadedAt!: string;
}

export class ParticipantDetailDto
  extends ParticipantRowDto
  implements ParticipantDetail
{
  @ApiProperty()
  eventId!: string;

  @ApiProperty({ example: 'Kickoff in Köln' })
  eventName!: string;

  @ApiProperty({
    type: [AttachmentSummaryDto],
    description:
      'The files uploaded with this registration, in form order. The bytes are ' +
      'fetched one at a time from `/api/admin/attachments/{id}`; the upload ' +
      'volume is never served statically (E9).',
  })
  attachments!: AttachmentSummaryDto[];
}
