import { ApiProperty } from '@nestjs/swagger';
import type {
  ContactRequestAcknowledgement,
  ContactRequestInput,
} from '@trefaro/shared-models';
import {
  MAX_GUEST_EMAIL_LENGTH,
  MAX_GUEST_NAME_LENGTH,
  MAX_MESSAGE_LENGTH,
} from '@trefaro/shared-models';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

/**
 * What the contact form on an event landing page sends (FR 3.4, UC 14).
 *
 * Three fields, all required, and no picture: this is the one endpoint of the
 * chat a stranger can reach, so it accepts words and nothing else (E40's
 * pictures need an account behind them). The bounds come from
 * `shared-models`, which is where the client reads them for its own
 * `maxlength` — a form that could only fail in the database would be a form
 * that lets somebody type for five minutes and then loses it.
 *
 * `Length(1, …)` cannot see that `"   "` has a length; the service trims and
 * refuses, because the database's `CHK_message_body` would otherwise answer
 * with a constraint violation instead of a sentence.
 */
export class CreateContactRequestDto implements ContactRequestInput {
  @ApiProperty({
    example: 'Amina Okonkwo',
    description:
      'One field, not two: a registration puts a person on a list and is ' +
      'sorted by surname, a question is signed.',
  })
  @IsString()
  @Length(1, MAX_GUEST_NAME_LENGTH)
  name!: string;

  @ApiProperty({
    example: 'amina@example.org',
    description:
      'Where the answer goes (F11). Stored on the conversation and never ' +
      'verified — nothing is sent to it by this request.',
  })
  @IsEmail()
  @MaxLength(MAX_GUEST_EMAIL_LENGTH)
  email!: string;

  @ApiProperty({
    example: 'Is the venue accessible by wheelchair?',
    description: 'Becomes the first message of the conversation (E39).',
  })
  @IsString()
  @Length(1, MAX_MESSAGE_LENGTH)
  body!: string;
}

/** What the form gets back: the address it wrote to, and nothing else (E10). */
export class ContactRequestAcknowledgementDto implements ContactRequestAcknowledgement {
  @ApiProperty({ example: 'amina@example.org' })
  email!: string;
}
