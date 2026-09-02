import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  CustomFieldValues,
  ParticipantPasswordChange,
  ParticipantProfileUpdate,
} from '@trefaro/shared-models';
import {
  MAX_ACTIVITY_AREAS_LENGTH,
  brandingTypeSummary,
} from '@trefaro/shared-models';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../../common/password-policy';

/**
 * What the profile form sends (FR 4.3).
 *
 * Every property optional, because a `PATCH` says what changed. Two things are
 * deliberately absent:
 *
 * - **The address** (E31). It is the identity, the registrations of this person
 *   are found by it, and changing it would cut the history rather than carry it
 *   along.
 * - **The picture.** Bytes are not a form field: they are written the moment
 *   they are uploaded, through a route of their own (F116).
 */
export class UpdateProfileDto implements ParticipantProfileUpdate {
  @ApiPropertyOptional({ example: 'Amina' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Okonkwo' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @ApiPropertyOptional({
    example: 'de',
    description:
      'BCP 47 tag. It is the language this person is written to in, so a ' +
      'regional tag is its own language (F90).',
  })
  @IsOptional()
  @IsString()
  @Length(2, 16)
  preferredLocale?: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: 'Citizens’ assemblies, election observation',
    description:
      'Free text; the participant search filters on it (E36). An empty ' +
      'string means "no longer stated".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ACTIVITY_AREAS_LENGTH)
  activityAreas?: string | null;

  @ApiPropertyOptional({
    type: Object,
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'boolean' }] },
    example: { 'local-group': 'Cologne', 'code-of-conduct': true },
    description:
      'The answers to this instance’s profile questions, keyed by field key ' +
      '(E35). Whole when present, not a patch: "required" is a property of ' +
      'the form and cannot be judged on a fragment of it. Deliberately not ' +
      'validated structurally here — what is acceptable follows from the ' +
      'definitions, and a second copy of those rules in a DTO would be the ' +
      'copy that drifts.',
  })
  @IsOptional()
  @IsObject()
  customFields?: CustomFieldValues;

  @ApiPropertyOptional({
    description:
      'Whether this profile may be found by other participants — and written ' +
      'to (E37, F13). Writable now; the search that reads it arrives with the ' +
      'work package that builds it.',
  })
  @IsOptional()
  @IsBoolean()
  searchable?: boolean;
}

/**
 * Changing the password from inside the profile (FR 4.3).
 *
 * With the current one: whoever is holding this session may have found the
 * screen unlocked. A reset for somebody who has forgotten their password is a
 * different route with a different token, and it is not part of FR 4.3.
 */
export class ChangePasswordDto implements ParticipantPasswordChange {
  @ApiProperty({ description: 'Verified against the stored hash.' })
  @IsString()
  @Length(1, MAX_PASSWORD_LENGTH)
  currentPassword!: string;

  @ApiProperty({
    minLength: MIN_PASSWORD_LENGTH,
    description:
      'Length only, no character classes — a long passphrase is stronger and ' +
      'easier to remember than "Passwort1!" (NFR 4).',
  })
  @IsString()
  @Length(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH)
  newPassword!: string;
}

/**
 * The multipart body of an avatar upload, for the OpenAPI description only.
 *
 * `multipart/form-data` cannot be described by the interface the endpoint
 * really takes, so this class exists to make `/api/docs` usable — one file
 * part, and the rules stated where somebody trying the endpoint reads them.
 */
export class AvatarUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      `The picture — one of ${brandingTypeSummary()}. The same rules as the ` +
      'organization logo, on purpose: one answer to "what may I upload here". ' +
      'No SVG (it can carry script and would be served from the client’s own ' +
      "origin), and the type is verified against the file's first bytes, so " +
      'renaming does not help.',
  })
  file!: unknown;
}
