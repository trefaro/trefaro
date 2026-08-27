import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { InvitationInput } from '@trefaro/shared-models';
import {
  MAX_INVITATION_BODY_LENGTH,
  MAX_INVITATION_RECIPIENTS,
  MAX_INVITATION_SUBJECT_LENGTH,
} from '@trefaro/shared-models';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

/**
 * What an organizer sends to invite former participants (FR 2.4, F24).
 *
 * `recipients` is the field that decides what this endpoint is. It takes
 * registration ids and there is no variant that takes addresses (F55) — every
 * id is looked up again through the audience filter, so an id from another
 * series, an unconfirmed registration or somebody who objected is refused
 * rather than written to (E15).
 *
 * `@IsUUID` on each element is not cosmetic: the ids reach a `uuid[]` parameter
 * in SQL, and a malformed one has to be a 400 here rather than a database error
 * later.
 */
export class CreateInvitationDto implements InvitationInput {
  @ApiProperty({
    example: 'You are invited: Democracy Days 2027',
    description: 'The mail’s subject, as the organizer wrote it.',
  })
  @IsString()
  @Length(1, MAX_INVITATION_SUBJECT_LENGTH)
  subject!: string;

  @ApiProperty({
    example:
      'we would love to see you again this year.\n\nThe programme is taking ' +
      'shape and registration is open.',
    description:
      'Plain text. Blank lines separate paragraphs; the template writes the ' +
      'greeting, the event block and the objection link around it (F58).',
  })
  @IsString()
  @Length(1, MAX_INVITATION_BODY_LENGTH)
  body!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'An event of the same series to invite to. Absent for a message that ' +
      'names none; an event of another series is refused.',
  })
  @IsOptional()
  @IsUUID()
  eventId?: string | null;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description:
      'Registration ids from the contact list — never e-mail addresses (F55).',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_INVITATION_RECIPIENTS)
  @IsUUID('all', { each: true })
  recipients!: string[];
}
