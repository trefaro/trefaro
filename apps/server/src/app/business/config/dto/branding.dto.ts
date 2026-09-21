import { ApiProperty } from '@nestjs/swagger';
import type {
  BrandingImages,
  BrandingState,
  ImageSize,
} from '@trefaro/shared-models';
import {
  MAX_BRANDING_BYTES,
  MIN_INSTALLABLE_ICON_PX,
  brandingTypeSummary,
} from '@trefaro/shared-models';

/**
 * What the upload and removal endpoints answer with (FR 1.4, E19).
 *
 * Both URLs, not only the one that changed: the design page shows two previews,
 * and the version in `?v=` belongs to the whole configuration row — replacing
 * the logo therefore changes the app icon's URL too. Answering with one of them
 * would leave the page holding a URL that is no longer the current one.
 */
export class BrandingImagesDto implements BrandingImages {
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

/** The pixel size an image's own header states. */
export class ImageSizeDto implements ImageSize {
  @ApiProperty({ example: 500 })
  width!: number;

  @ApiProperty({ example: 120 })
  height!: number;
}

/**
 * The two images and what the app icon will be used for (F224).
 *
 * What the writes answer with and what `GET /api/admin/config/images` reads,
 * and deliberately *not* part of `/api/config`: the size is read out of the
 * file rather than out of a column, and the public configuration is fetched on
 * every start of either client.
 */
export class BrandingStateDto
  extends BrandingImagesDto
  implements BrandingState
{
  @ApiProperty({
    nullable: true,
    type: ImageSizeDto,
    description:
      'The app icon\u2019s pixel size, read from its own header (F106), or ' +
      '`null` when no icon is uploaded or the header does not say. An icon ' +
      `that is not square or below ${MIN_INSTALLABLE_ICON_PX} pixels stays ` +
      'beside the shipped ones in the manifest rather than replacing them ' +
      '(F105) \u2014 which is what the design page puts into words.',
  })
  appIconSize!: ImageSize | null;
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
