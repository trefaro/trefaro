import { ApiProperty } from '@nestjs/swagger';
import type {
  AvatarImage,
  CustomFieldValues,
  ParticipantAccount,
  ParticipantSessionInfo,
  ProfileConfirmation,
  ProfileRegistrationAcknowledgement,
} from '@trefaro/shared-models';
import { avatarUrl } from '../avatar-url';
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

  @ApiProperty({
    nullable: true,
    type: String,
    example: '/api/media/profiles/6f1c…/avatar?v=1787790600000',
    description:
      'Public URL of the profile picture, or `null`. It carries no stored ' +
      'path — the route resolves the file through the account (F124) — and a ' +
      'new upload produces a new `?v=`.',
  })
  avatarUrl!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Citizens’ assemblies, election observation',
    description:
      'Free text. Its own field rather than a profile question, because the ' +
      'participant search filters on it (E36).',
  })
  activityAreas!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'boolean' }] },
    example: { 'local-group': 'Cologne', newsletter: true },
    description:
      'The answers to this instance’s profile questions, by field key. Only ' +
      'answered questions appear (F36).',
  })
  customFields!: CustomFieldValues;

  @ApiProperty({
    description:
      'Whether this profile may be found by other participants — and written ' +
      'to. One switch, one meaning (E37, F13). Off unless its owner says so.',
  })
  searchable!: boolean;

  @ApiProperty({ format: 'date-time' })
  confirmedAt!: string;
}

/** What the avatar upload and removal endpoints answer with (FR 4.3). */
export class AvatarImageDto implements AvatarImage {
  @ApiProperty({
    nullable: true,
    type: String,
    example: '/api/media/profiles/6f1c…/avatar?v=1787790600000',
    description: 'The new URL of the picture, or `null` after it was removed.',
  })
  avatarUrl!: string | null;
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
    // The stored path never leaves the server; what a client gets is the route
    // that resolves it, versioned by the row's own timestamp (F124).
    avatarUrl: avatarUrl(profile.id, profile.avatarPath, profile.updatedAt),
    activityAreas: profile.activityAreas,
    customFields: profile.customFields,
    searchable: profile.searchable,
    confirmedAt: (profile.confirmedAt ?? profile.createdAt).toISOString(),
  };
}
