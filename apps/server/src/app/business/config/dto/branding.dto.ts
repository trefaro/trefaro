import { ApiProperty } from '@nestjs/swagger';
import {
  MAX_BRANDING_BYTES,
  brandingTypeSummary,
} from '@trefaro/shared-models';
import type { BrandingImageUrls } from '../branding-url';

/**
 * What the upload and removal endpoints answer with (FR 1.4, E19).
 *
 * Both URLs, not only the one that changed: the design page shows two previews,
 * and the version in `?v=` belongs to the whole configuration row — replacing
 * the logo therefore changes the app icon's URL too. Answering with one of them
 * would leave the page holding a URL that is no longer the current one.
 */
export class BrandingImagesDto implements BrandingImageUrls {
  @ApiProperty({
    nullable: true,
    type: String,
    example: '/api/media/branding/logo?v=1787790100000',
    description:
      'Public URL of the logo, or `null` while none is uploaded. It carries no ' +
      'stored path — the route resolves the image through the configuration ' +
      '(E19) — and a new upload produces a new `?v=`.',
  })
  logoUrl!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '/api/media/branding/app-icon?v=1787790100000',
    description:
      'Public URL of the square PWA icon, or `null` while none is uploaded — ' +
      'in which case the shipped maskable icons apply (E26).',
  })
  appIconUrl!: string | null;
}

/**
 * The multipart body of an upload, for the OpenAPI description only.
 *
 * `multipart/form-data` cannot be described by the interface the endpoint really
 * takes, so this class exists to make `/api/docs` usable — one file part, and the
 * rules stated where somebody trying the endpoint reads them.
 */
export class BrandingImageUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      `The image — one of ${brandingTypeSummary()}, at most ` +
      `${MAX_BRANDING_BYTES} bytes. No SVG: it can carry script and would be ` +
      "served from the client's own origin. The type is verified against the " +
      "file's first bytes, so renaming does not help.",
  })
  file!: unknown;
}
