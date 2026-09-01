import { ApiProperty } from '@nestjs/swagger';
import type { LogoImage } from '@trefaro/shared-models';
import {
  MAX_BRANDING_BYTES,
  brandingTypeSummary,
} from '@trefaro/shared-models';

/**
 * What the logo upload and removal endpoints answer with (FR 2.1, FR 3.1).
 *
 * One URL, not the whole row: the form that uploaded it needs to draw the new
 * picture, and it already holds everything else. Answering with the full series
 * or event would make the two endpoints a second way to read a row, with a
 * second place for its shape to drift.
 */
export class LogoImageDto implements LogoImage {
  @ApiProperty({
    nullable: true,
    type: String,
    example: '/api/media/series/6f1c…/logo?v=1787790400000',
    description:
      'Public URL of the logo, or `null` after it was removed. It carries no ' +
      'stored path — the route resolves the file through the row (E19) — and a ' +
      'new upload produces a new `?v=`.',
  })
  logoUrl!: string | null;
}

/**
 * The multipart body of a logo upload, for the OpenAPI description only.
 *
 * `multipart/form-data` cannot be described by the interface the endpoint really
 * takes, so this class exists to make `/api/docs` usable — one file part, and the
 * rules stated where somebody trying the endpoint reads them.
 */
export class LogoImageUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      `The image — one of ${brandingTypeSummary()}, at most ` +
      `${MAX_BRANDING_BYTES} bytes. The same rules as the organization logo, ` +
      'on purpose. No SVG: it can carry script and would be served from the ' +
      "client's own origin. The type is verified against the file's first " +
      'bytes, so renaming does not help.',
  })
  file!: unknown;
}
