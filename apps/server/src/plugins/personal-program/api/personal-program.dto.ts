import { ApiProperty } from '@nestjs/swagger';
import type { PersonalProgramItem } from '@trefaro/shared-models';

/**
 * The plug-in's one payload, implementing the interface both clients share from
 * `shared-models` — so a field that drifts is a build error, not a failed
 * request.
 *
 * There is no incoming payload at all: putting a session in a plan and taking
 * it out are `PUT` and `DELETE` on the session's own address, and both answer
 * 204. A body would have to say something, and there is nothing to say — the
 * address is the whole request (E55).
 */
export class PersonalProgramItemDto implements PersonalProgramItem {
  @ApiProperty({ format: 'uuid' })
  programItemId!: string;

  @ApiProperty({
    description:
      'Translated for the reader where a translation exists, the original ' +
      'where none does (E56, F95).',
    example: 'Workshop: Campaigning without a budget',
  })
  title!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({
    description:
      'IANA zone the two instants are read in — the event’s, never the ' +
      'reader’s (E8, E69).',
    example: 'Europe/Berlin',
  })
  timezone!: string;

  @ApiProperty({
    description:
      'Whether this session asks who is coming (FR 3.10). Where it is true, ' +
      'a seat is booked in the event’s programme — never here (E55).',
  })
  registrationEnabled!: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Seats, or null for “as many as come”.',
    example: 30,
  })
  capacity!: number | null;

  @ApiProperty({
    description: 'Whether the reader has this session in their plan.',
  })
  inPlan!: boolean;
}
