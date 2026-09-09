import { ApiProperty } from '@nestjs/swagger';
import {
  MAX_ADMISSION_PAGE_SIZE,
  MAX_CHECKIN_CODE_LENGTH,
  type AdmissionPage,
  type AdmissionRow,
  type CheckinPageQuery,
  type CheckinResult,
  type CheckinScan,
  type CheckinTicket,
  type CheckinTicketPage,
} from '@trefaro/shared-models';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/**
 * The payloads of the QR check-in plug-in.
 *
 * Each one implements the interface of the same name in `shared-models`: a
 * client that loads this plug-in's bundle shares the models with it, so a change
 * to the shape breaks a build rather than a request.
 */
export class CheckinTicketDto implements CheckinTicket {
  @ApiProperty({ format: 'uuid' })
  registrationId!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({ example: 'Amina' })
  firstName!: string;

  @ApiProperty({ example: 'Okonkwo' })
  lastName!: string;

  @ApiProperty({
    example: 'K7QF3M2X9TVB4ND8RJ0HC5WGYP',
    description:
      'Opaque, this plug-in’s own, issued once per registration (E53). Never ' +
      'the signed self-service token, which can cancel a registration.',
  })
  code!: string;

  @ApiProperty({ format: 'date-time' })
  issuedAt!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: '`null` while they have not arrived.',
  })
  checkedInAt!: string | null;
}

export class CheckinTicketPageDto implements CheckinTicketPage {
  @ApiProperty({ type: [CheckinTicketDto] })
  rows!: readonly CheckinTicketDto[];

  @ApiProperty({
    description: 'What the pages divide, not this page’s length.',
  })
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class AdmissionRowDto implements AdmissionRow {
  @ApiProperty({ format: 'uuid' })
  registrationId!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({
    description:
      'The same code the camera would read, so a button beside the row can ' +
      'send it (F199) — one route for the door, whichever way the code got ' +
      'there.',
  })
  code!: string;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  checkedInAt!: string | null;
}

export class AdmissionPageDto implements AdmissionPage {
  @ApiProperty({ type: [AdmissionRowDto] })
  rows!: readonly AdmissionRowDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class CheckinResultDto implements CheckinResult {
  @ApiProperty({ format: 'uuid' })
  registrationId!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({
    format: 'date-time',
    description: 'When they walked in — the first admission, never the latest.',
  })
  checkedInAt!: string;

  @ApiProperty({
    description:
      'True when this code had already been read. Not an error (E53): “already ' +
      'here, since 09:12” is the sentence somebody at a door needs.',
  })
  alreadyCheckedIn!: boolean;
}

/** What the door sends: the code that was scanned, or typed (F199). */
export class CheckinScanDto implements CheckinScan {
  @ApiProperty({
    maxLength: MAX_CHECKIN_CODE_LENGTH,
    description:
      'Compared case-insensitively and trimmed: a camera hands over what is in ' +
      'the code, a person types with the caps lock off.',
  })
  @IsString()
  @Length(1, MAX_CHECKIN_CODE_LENGTH)
  code!: string;
}

/**
 * What a paginated list of this plug-in may be asked for.
 *
 * No filter and no sort. The admission list is one event's confirmed
 * registrations by name, and a `?state=` would be a second way to ask a
 * question every row already answers — the door reads the column.
 */
export class CheckinPageQueryDto implements CheckinPageQuery {
  @ApiProperty({ required: false, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({
    required: false,
    minimum: 1,
    maximum: MAX_ADMISSION_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ADMISSION_PAGE_SIZE)
  pageSize?: number;
}
