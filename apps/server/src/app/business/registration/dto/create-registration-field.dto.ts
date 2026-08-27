import { ApiProperty } from '@nestjs/swagger';
import type {
  RegistrationFieldChange,
  RegistrationFieldInput,
  RegistrationFieldOrder,
  RegistrationFieldType,
} from '@trefaro/shared-models';
import {
  MAX_FIELD_HELP_LENGTH,
  MAX_FIELD_KEY_LENGTH,
  MAX_FIELD_LABEL_LENGTH,
  MAX_FIELD_OPTIONS,
  MAX_FIELD_OPTION_LENGTH,
  MAX_REGISTRATION_FIELDS,
  REGISTRATION_FIELD_TYPES,
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
 * What an organizer sends when defining a field (F12, FR 3.5).
 *
 * The bounds here match the columns, so a request cannot fail in the database.
 * What they deliberately do *not* decide is whether the combination makes sense
 * — a selection field without choices, a checkbox with them — because that is a
 * product rule and belongs in the service that also enforces it on update.
 */
export class CreateRegistrationFieldDto implements RegistrationFieldInput {
  @ApiProperty({ example: 'Dietary requirements' })
  @IsString()
  @Length(1, MAX_FIELD_LABEL_LENGTH)
  label!: string;

  @ApiProperty({
    enum: REGISTRATION_FIELD_TYPES,
    description:
      'Fixed once the field exists: a selection turned into a checkbox would ' +
      'leave every answer already given as an invalid value of the new type.',
  })
  @IsIn(REGISTRATION_FIELD_TYPES)
  type!: RegistrationFieldType;

  @ApiProperty({
    required: false,
    description:
      'Normally omitted — the server derives the key from the label, the way ' +
      "it derives an event's public address from its name. Give one only when " +
      'it has to match something outside this application.',
  })
  @IsOptional()
  @IsString()
  @Length(1, MAX_FIELD_KEY_LENGTH)
  key?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_FIELD_HELP_LENGTH)
  helpText?: string | null;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Required for a selection field, refused for any other type.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FIELD_OPTIONS)
  @IsString({ each: true })
  @MaxLength(MAX_FIELD_OPTION_LENGTH, { each: true })
  options?: string[];

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

/**
 * What may be changed about an existing field.
 *
 * Neither the type nor the key: both are what the answers already given depend
 * on. The label is not — correcting the wording of a question is the most
 * ordinary thing an organizer does to a form.
 */
export class UpdateRegistrationFieldDto implements RegistrationFieldChange {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, MAX_FIELD_LABEL_LENGTH)
  label?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_FIELD_HELP_LENGTH)
  helpText?: string | null;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FIELD_OPTIONS)
  @IsString({ each: true })
  @MaxLength(MAX_FIELD_OPTION_LENGTH, { each: true })
  options?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

/** A new order for one event's form: every field id, once, in order. */
export class ReorderRegistrationFieldsDto implements RegistrationFieldOrder {
  @ApiProperty({
    type: [String],
    description:
      'The complete list, not a move: two requests that each move one field ' +
      'would otherwise interleave into an order neither organizer asked for.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_REGISTRATION_FIELDS)
  @IsUUID('4', { each: true })
  ids!: string[];
}
