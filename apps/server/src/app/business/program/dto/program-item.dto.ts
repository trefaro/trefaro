import { ApiProperty } from '@nestjs/swagger';
import type { ProgramItem, PublicProgramItem } from '@trefaro/shared-models';

/**
 * OpenAPI shapes of the programme (FR 3.7).
 *
 * Each class `implements` its interface from `@trefaro/shared-models`, so the
 * documented API and the types both clients compile against cannot drift apart.
 */
export class PublicProgramItemDto implements PublicProgramItem {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Keynote: Citizens’ initiatives in 2027' })
  title!: string;

  @ApiProperty({ required: false, nullable: true })
  description!: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'Dr. Amara Nwosu' })
  speaker!: string | null;

  @ApiProperty({
    format: 'date-time',
    description:
      'Absolute instant. Read it in the event’s `timezone`, not the reader’s ' +
      '(E8): a participant three zones away must not have to guess whose 09:00 ' +
      'this is.',
  })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;
}

export class ProgramItemDto
  extends PublicProgramItemDto
  implements ProgramItem
{
  @ApiProperty()
  eventId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
