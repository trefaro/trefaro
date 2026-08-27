import { ApiProperty, PartialType } from '@nestjs/swagger';
import type {
  ProgramItemChange,
  ProgramItemInput,
} from '@trefaro/shared-models';
import {
  MAX_PROGRAM_DESCRIPTION_LENGTH,
  MAX_PROGRAM_ITEM_CAPACITY,
  MAX_PROGRAM_SPEAKER_LENGTH,
  MAX_PROGRAM_TITLE_LENGTH,
} from '@trefaro/shared-models';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * What an organizer sends when planning a session (FR 3.7).
 *
 * The bounds match the columns, so a request cannot fail in the database. What
 * they deliberately do *not* decide is whether the times make sense — that they
 * lie inside the event and that the item has a length are product rules and
 * belong in the service, which enforces them on update as well.
 *
 * No room here, in any phase: the room a session happens in belongs to the room
 * planning plug-in's own join table (F21), and this endpoint would be the wrong
 * place to accept it even if it existed — a core DTO that knows about rooms is
 * the coupling the decision was made to avoid.
 */
export class CreateProgramItemDto implements ProgramItemInput {
  @ApiProperty({ example: 'Keynote: Citizens’ initiatives in 2027' })
  @IsString()
  @Length(1, MAX_PROGRAM_TITLE_LENGTH)
  title!: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'The session abstract, as participants read it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PROGRAM_DESCRIPTION_LENGTH)
  description?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'Dr. Amara Nwosu',
    description:
      'A name, not an account: there is no participant login in phase 1, and a ' +
      'speaker is not necessarily a registered participant in any phase.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PROGRAM_SPEAKER_LENGTH)
  speaker?: string | null;

  @ApiProperty({
    format: 'date-time',
    example: '2027-06-14T07:00:00.000Z',
    description:
      'Absolute instant. Rendered in the event’s zone, never the reader’s (E8) ' +
      '— a programme item carries no zone of its own.',
  })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ format: 'date-time', example: '2027-06-14T08:30:00.000Z' })
  @IsDateString()
  endsAt!: string;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'Whether this session asks who is coming (FR 3.10). Off for the plenary ' +
      'everybody attends, on for the workshop with twelve chairs.',
  })
  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 12,
    description:
      'Seats, or absent for "as many as come". Refused without ' +
      '`registrationEnabled`: a limit nothing enforces reads like one that is.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PROGRAM_ITEM_CAPACITY)
  capacity?: number | null;
}

/**
 * Every field optional; only what is sent gets written.
 *
 * Unlike a registration field, nothing is fixed after creation: a programme item
 * has no key that answers or sign-ups are stored under.
 */
export class UpdateProgramItemDto
  extends PartialType(CreateProgramItemDto)
  implements ProgramItemChange {}
