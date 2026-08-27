import { ApiProperty, PartialType } from '@nestjs/swagger';
import type {
  MediaLinkChange,
  MediaLinkInput,
  MediaLinkKind,
} from '@trefaro/shared-models';
import {
  MAX_MEDIA_LINK_TITLE_LENGTH,
  MAX_MEDIA_LINK_URL_LENGTH,
  MEDIA_LINK_KINDS,
} from '@trefaro/shared-models';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

/**
 * What an organizer sends when adding a media link (FR 3.6, F10).
 *
 * The bounds match the columns, so a request cannot fail in the database. The
 * two product rules are enforced in the service as well: only `http` and
 * `https` addresses, and a session has to belong to the same event. A DTO is the
 * outer wall, not the only one — an import or a plug-in would go past it.
 */
export class CreateMediaLinkDto implements MediaLinkInput {
  @ApiProperty({
    enum: MEDIA_LINK_KINDS as string[],
    description:
      '`stream` while it is on, `recording` afterwards, `material` for ' +
      'everything to read.',
  })
  @IsIn(MEDIA_LINK_KINDS as string[])
  kind!: MediaLinkKind;

  @ApiProperty({ example: 'Recording of the opening keynote' })
  @IsString()
  @Length(1, MAX_MEDIA_LINK_TITLE_LENGTH)
  title!: string;

  @ApiProperty({ example: 'https://tube.example.org/w/opening-keynote' })
  @IsString()
  // `require_protocol` because a bare word would otherwise pass and then
  // resolve against this instance; `protocols` because a `javascript:` href is
  // a script somebody runs by clicking a link.
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(MAX_MEDIA_LINK_URL_LENGTH)
  url!: string;

  @ApiProperty({
    required: false,
    nullable: true,
    format: 'uuid',
    description:
      'A session of the same event, or absent for a link that belongs to the ' +
      'whole event.',
  })
  @IsOptional()
  @IsUUID()
  programItemId?: string | null;
}

/** Every field optional; only what is sent gets written. */
export class UpdateMediaLinkDto
  extends PartialType(CreateMediaLinkDto)
  implements MediaLinkChange {}
