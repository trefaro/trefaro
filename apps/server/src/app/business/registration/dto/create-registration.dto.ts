import { ApiProperty } from '@nestjs/swagger';
import type {
  CustomFieldValues,
  RegistrationInput,
} from '@trefaro/shared-models';
import {
  IsBoolean,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/** Bounds that match the columns, so a request cannot fail in the database. */
const MAX_NAME_LENGTH = 100;
/** The longest address RFC 5321 allows, so nobody's real address is refused. */
const MAX_EMAIL_LENGTH = 320;
const MAX_PHONE_LENGTH = 50;
const MAX_ORIGIN_LENGTH = 200;

/**
 * What the registration form sends (FR 3.5, mockups 5.4).
 *
 * Mandatory: first name, last name, e-mail — the three fields FR 3.5 names.
 * Everything the organizer added beyond them travels in `customFields` (F12).
 *
 * An unknown property of this class is rejected rather than dropped, because the
 * global validation pipe runs with `forbidNonWhitelisted`. An unknown *field
 * key* inside `customFields` is rejected too — but by the service, against the
 * definitions of that event, because nothing else knows them.
 */
export class CreateRegistrationDto implements RegistrationInput {
  @ApiProperty({ example: 'Amina' })
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  firstName!: string;

  @ApiProperty({ example: 'Okonkwo' })
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  lastName!: string;

  @ApiProperty({
    example: 'amina@example.org',
    description:
      'Compared and stored lower-cased: one address is one registration per ' +
      'event (E10).',
  })
  @IsEmail()
  @MaxLength(MAX_EMAIL_LENGTH)
  email!: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Optional — organizers ask for it for travel and visa letters.',
  })
  @IsOptional()
  @IsString()
  @Length(1, MAX_PHONE_LENGTH)
  phone?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Free text: country, city or organization.',
  })
  @IsOptional()
  @IsString()
  @Length(1, MAX_ORIGIN_LENGTH)
  origin?: string | null;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'Consent to be contacted about later events of this series (E15). ' +
      'Never pre-checked in the form.',
  })
  @IsOptional()
  @IsBoolean()
  newsletterOptIn?: boolean;

  @ApiProperty({
    required: false,
    type: Object,
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'boolean' }] },
    example: { 'dietary-requirements': 'vegan', 'code-of-conduct': true },
    description:
      "Answers to the fields this event defines (F12), keyed by the field's " +
      'key. Deliberately not validated structurally here: what is acceptable ' +
      'follows from the definitions, and a second copy of those rules in a DTO ' +
      'would be the copy that drifts.',
  })
  @IsOptional()
  @IsObject()
  customFields?: CustomFieldValues;
}

/** The token from the confirmation link, posted by the page it points at (E5b). */
export class ConfirmRegistrationDto {
  @ApiProperty({
    description: 'The `token` query parameter of the mailed link.',
  })
  @IsString()
  @Length(1, 1024)
  token!: string;
}
