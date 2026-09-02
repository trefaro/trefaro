import { ApiProperty } from '@nestjs/swagger';
import type {
  ParticipantAccount,
  ParticipantSessionInfo,
  ProfileConfirmation,
  ProfileRegistrationAcknowledgement,
} from '@trefaro/shared-models';
import type { UserProfileRecord } from '../ports/user-profile.repository';

/**
 * OpenAPI shapes for the participant account endpoints.
 *
 * Each class `implements` the interface from `@trefaro/shared-models`, so the
 * documented API and the type the participant client compiles against cannot
 * drift apart without breaking the build.
 */
export class ParticipantAccountDto implements ParticipantAccount {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    example: 'amina@example.org',
    description: 'The identity of this person, and not changeable (E31).',
  })
  email!: string;

  @ApiProperty({ example: 'Amina' })
  firstName!: string;

  @ApiProperty({ example: 'Okonkwo' })
  lastName!: string;

  @ApiProperty({ example: 'de', description: 'BCP 47 tag.' })
  preferredLocale!: string;

  @ApiProperty({ format: 'date-time' })
  confirmedAt!: string;
}

export class ParticipantSessionInfoDto implements ParticipantSessionInfo {
  @ApiProperty({ type: ParticipantAccountDto })
  participant!: ParticipantAccountDto;

  @ApiProperty({
    format: 'date-time',
    description:
      'When the session lapses if it is not used. Every request slides it forward.',
  })
  expiresAt!: string;
}

export class ProfileRegistrationAcknowledgementDto implements ProfileRegistrationAcknowledgement {
  @ApiProperty({
    example: 'amina@example.org',
    description:
      'The address the confirmation was sent to. The only thing this answer ' +
      'carries, whatever state the address was in (E32).',
  })
  email!: string;
}

export class ProfileConfirmationDto implements ProfileConfirmation {
  @ApiProperty({ enum: ['confirmed', 'already-confirmed'] })
  state!: 'confirmed' | 'already-confirmed';

  @ApiProperty({ example: 'Amina' })
  firstName!: string;
}

/**
 * A profile as its owner may see it.
 *
 * Never carries the password hash, and `confirmedAt` is non-null by
 * construction: this shape is only produced for somebody holding a session, and
 * a session is only issued after the address was confirmed (E32).
 */
export function toParticipantAccountDto(
  profile: UserProfileRecord,
): ParticipantAccountDto {
  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    preferredLocale: profile.preferredLocale,
    confirmedAt: (profile.confirmedAt ?? profile.createdAt).toISOString(),
  };
}
