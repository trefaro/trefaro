import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  ProfileField,
  ProfileFieldChange,
  ProfileFieldInput,
  ProfileFieldOrder,
  ProfileFieldPublic,
  ProfileFieldType,
} from '@trefaro/shared-models';
import {
  MAX_FIELD_HELP_LENGTH,
  MAX_FIELD_KEY_LENGTH,
  MAX_FIELD_LABEL_LENGTH,
  MAX_FIELD_OPTIONS,
  MAX_FIELD_OPTION_LENGTH,
  MAX_PROFILE_FIELDS,
  PROFILE_FIELD_TYPES,
} from '@trefaro/shared-models';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

/**
 * The profile field kit over HTTP (FR 4.3 — E35).
 *
 * The registration kit's DTOs with the file properties removed and no
 * `eventId`: there is one profile form per instance, and a file is not an answer
 * a profile can give (F37). The bounds match the columns, so a request cannot
 * fail in the database; whether the *combination* makes sense — a selection
 * without choices, a checkbox with them — is a product rule and stays in the
 * service, which also has to enforce it on update.
 */
export class ProfileFieldDto implements ProfileField {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    example: 'local-group',
    description:
      'What an answer is stored under. Derived from the label and immutable ' +
      'from then on (F35) — which is what lets a question be rephrased.',
  })
  key!: string;

  @ApiProperty({ example: 'Which local group are you part of?' })
  label!: string;

  @ApiProperty({ enum: PROFILE_FIELD_TYPES })
  type!: ProfileFieldType;

  @ApiProperty({ nullable: true, type: String })
  helpText!: string | null;

  @ApiProperty({ type: [String] })
  options!: string[];

  @ApiProperty()
  required!: boolean;

  @ApiProperty({ description: 'Position in the form, ascending and gapless.' })
  sort!: number;
}

/** A question as the profile form renders it — no id, no position. */
export class ProfileFieldPublicDto implements ProfileFieldPublic {
  @ApiProperty({ example: 'local-group' })
  key!: string;

  @ApiProperty({ example: 'Which local group are you part of?' })
  label!: string;

  @ApiProperty({ enum: PROFILE_FIELD_TYPES })
  type!: ProfileFieldType;

  @ApiProperty({ nullable: true, type: String })
  helpText!: string | null;

  @ApiProperty({ type: [String] })
  options!: string[];

  @ApiProperty({
    description:
      'Whether the profile form may be submitted without it. Required of the ' +
      'form, not of every existing profile — a question added today cannot ' +
      'make yesterday’s profiles invalid.',
  })
  required!: boolean;
}

export class CreateProfileFieldDto implements ProfileFieldInput {
  @ApiProperty({ example: 'Which local group are you part of?' })
  @IsString()
  @Length(1, MAX_FIELD_LABEL_LENGTH)
  label!: string;

  @ApiProperty({
    enum: PROFILE_FIELD_TYPES,
    description:
      'Fixed once the question exists: a selection turned into a checkbox ' +
      'would leave every answer already given as an invalid value of the new ' +
      'type. There is no file type — a file is not an answer a profile can ' +
      'give (F37).',
  })
  @IsIn(PROFILE_FIELD_TYPES)
  type!: ProfileFieldType;

  @ApiPropertyOptional({
    description:
      'Normally omitted — the server derives the key from the label. Give one ' +
      'only when it has to match something outside this application.',
  })
  @IsOptional()
  @IsString()
  @Length(1, MAX_FIELD_KEY_LENGTH)
  key?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_FIELD_HELP_LENGTH)
  helpText?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'Required for a selection field, refused for any other type.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FIELD_OPTIONS)
  @IsString({ each: true })
  @MaxLength(MAX_FIELD_OPTION_LENGTH, { each: true })
  options?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

/** What may be changed: everything except the type and the key (F35). */
export class UpdateProfileFieldDto implements ProfileFieldChange {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_FIELD_LABEL_LENGTH)
  label?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_FIELD_HELP_LENGTH)
  helpText?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FIELD_OPTIONS)
  @IsString({ each: true })
  @MaxLength(MAX_FIELD_OPTION_LENGTH, { each: true })
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

/** A new order for the profile form: every question id, once, in order. */
export class ReorderProfileFieldsDto implements ProfileFieldOrder {
  @ApiProperty({
    type: [String],
    description:
      'The complete list, not a move: two requests that each move one ' +
      'question would otherwise interleave into an order neither organizer ' +
      'asked for.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_PROFILE_FIELDS)
  @IsUUID('4', { each: true })
  ids!: string[];
}
