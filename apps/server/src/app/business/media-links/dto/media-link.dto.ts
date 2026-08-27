import { ApiProperty } from '@nestjs/swagger';
import type {
  MediaLink,
  MediaLinkKind,
  PublicMediaLink,
} from '@trefaro/shared-models';
import { MEDIA_LINK_KINDS } from '@trefaro/shared-models';

/**
 * OpenAPI shapes of the media links (FR 3.6, F10).
 *
 * Each class `implements` its interface from `@trefaro/shared-models`, so the
 * documented API and the types both clients compile against cannot drift apart.
 */
export class PublicMediaLinkDto implements PublicMediaLink {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    enum: MEDIA_LINK_KINDS as string[],
    description:
      'Also the order the sections are shown in: what is on now, what can be ' +
      'watched again, what can be read (F52).',
  })
  kind!: MediaLinkKind;

  @ApiProperty({
    example: 'Recording of the opening keynote',
    description:
      'Written by the organizer. The instance never asks the target what it ' +
      'is called — no oEmbed, no thumbnail, no request to a third party (F51).',
  })
  title!: string;

  @ApiProperty({
    example: 'https://tube.example.org/w/opening-keynote',
    description:
      'An external address, `http` or `https`. Rendered as a link, never in an ' +
      'iframe: embedding would load a third party’s code into a page that ' +
      'promises not to (NFR 9, F51).',
  })
  url!: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    type: String,
    description:
      'The session this link belongs to, or `null` for the event as a whole. A ' +
      'session of another event is refused — and cannot be stored either, ' +
      'because the foreign key is the pair `(program_item_id, event_id)`.',
  })
  programItemId!: string | null;
}

export class MediaLinkDto extends PublicMediaLinkDto implements MediaLink {
  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
