import { ApiProperty } from '@nestjs/swagger';
import type {
  RegistrationField,
  RegistrationFieldPublic,
  RegistrationFieldType,
} from '@trefaro/shared-models';
import { REGISTRATION_FIELD_TYPES } from '@trefaro/shared-models';

/**
 * OpenAPI shapes of the field kit (F12, FR 3.5).
 *
 * Each class `implements` its interface from `@trefaro/shared-models`, so the
 * documented API and the types both clients compile against cannot drift apart.
 */
export class RegistrationFieldPublicDto implements RegistrationFieldPublic {
  @ApiProperty({
    example: 'dietary-requirements',
    description:
      'What the answer is stored under. Stable: correcting the label does not ' +
      'change it, which is what keeps answers already given attached to their ' +
      'question.',
  })
  key!: string;

  @ApiProperty({ example: 'Dietary requirements' })
  label!: string;

  @ApiProperty({ enum: REGISTRATION_FIELD_TYPES })
  type!: RegistrationFieldType;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Shown under the input — the place to say why it is asked.',
  })
  helpText!: string | null;

  @ApiProperty({
    type: [String],
    description: 'The choices of a selection field; empty for any other type.',
  })
  options!: string[];

  @ApiProperty({
    description:
      'A required checkbox has to be ticked, not merely answered — a consent ' +
      'box that accepts "no" is not a consent box.',
  })
  required!: boolean;
}

export class RegistrationFieldDto
  extends RegistrationFieldPublicDto
  implements RegistrationField
{
  @ApiProperty()
  id!: string;

  @ApiProperty()
  eventId!: string;

  @ApiProperty({ description: 'Position in the form, ascending and gapless.' })
  sort!: number;
}
