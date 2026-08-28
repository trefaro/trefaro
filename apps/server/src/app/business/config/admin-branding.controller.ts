import {
  BadRequestException,
  Controller,
  Delete,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { BrandingImageKind } from '@trefaro/shared-models';
import {
  BRANDING_IMAGE_PART,
  MAX_BRANDING_BYTES,
  brandingTypeSummary,
} from '@trefaro/shared-models';
import { BrandingService } from './branding.service';
import { BrandingImageUploadDto, BrandingImagesDto } from './dto/branding.dto';

/**
 * One multipart part, and nothing else.
 *
 * `files: 1` and `fields: 0` because that is the whole request: an image
 * replaces an image. Anything else in the body is a caller doing something other
 * than what this endpoint does, and refusing it here is cheaper than reasoning
 * about it later.
 *
 * The size limit is the same number the service checks. Both, on purpose: the
 * parser's limit is what keeps the bytes from being read into memory at all, the
 * service's is what still holds for a caller that never went through a
 * controller (a seed script, a later import).
 */
const UPLOAD_OPTIONS = {
  limits: { fileSize: MAX_BRANDING_BYTES, files: 1, fields: 0 },
};

/**
 * What the multipart parser hands over — the two properties this needs.
 *
 * Declared here rather than imported, like `MultipartFile` in the registration
 * module: the business layer has no other reason to depend on the type package
 * of a parser, and neither the part name nor the original file name matters to a
 * logo. Nothing about the name is kept: a branding image is served under a route
 * of its own, never as a download.
 */
interface MultipartFile {
  readonly mimetype: string;
  readonly buffer: Buffer;
}

/**
 * Uploading and removing the logo and the app icon (FR 1.4, E19, E26).
 *
 * Under `/api/admin/config` because that is what they are — two more values of
 * the whitelabel configuration — and behind the administrative session by virtue
 * of that path (E16), with no decorator to forget.
 *
 * `PUT` rather than `POST`: there is exactly one logo and exactly one app icon,
 * and uploading twice replaces rather than accumulates. `DELETE` takes the image
 * away and leaves the instance showing its name (and, for the icon, the shipped
 * maskable ones).
 *
 * Two explicit routes per image rather than one with the kind as a parameter.
 * The kinds are a closed set of two and will not grow often; spelling them out
 * means the routing table says what exists, which is the same reasoning that
 * keeps a caller-supplied path out of the public route.
 */
@ApiTags('configuration')
@Controller('admin/config')
export class AdminBrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Put('logo')
  @UseInterceptors(FileInterceptor(BRANDING_IMAGE_PART, UPLOAD_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: BrandingImageUploadDto })
  @ApiOperation({
    summary: 'Replace the organization logo',
    description:
      'Served publicly, so a landing page can show it without a login. ' +
      `Accepts ${brandingTypeSummary()} up to ${MAX_BRANDING_BYTES} bytes; the ` +
      "type is checked against the file's own first bytes. Takes effect on the " +
      'next load of either client (E20).',
  })
  @ApiOkResponse({ type: BrandingImagesDto })
  @ApiBadRequestResponse({
    description:
      'No file, an empty one, a type that is not accepted, or bytes ' +
      'that do not match the declared type.',
  })
  @ApiPayloadTooLargeResponse({
    description: `An image above ${MAX_BRANDING_BYTES} bytes.`,
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  putLogo(
    @UploadedFile() file: MultipartFile | undefined,
  ): Promise<BrandingImagesDto> {
    return this.replace('logo', file);
  }

  @Delete('logo')
  @ApiOperation({
    summary: 'Remove the organization logo',
    description:
      'The clients fall back to the organization name. The file is removed from ' +
      'the upload volume — there is at most one of it, so a leftover would be ' +
      'invisible forever.',
  })
  @ApiOkResponse({ type: BrandingImagesDto })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  deleteLogo(): Promise<BrandingImagesDto> {
    return this.branding.remove('logo') as Promise<BrandingImagesDto>;
  }

  @Put('app-icon')
  @UseInterceptors(FileInterceptor(BRANDING_IMAGE_PART, UPLOAD_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: BrandingImageUploadDto })
  @ApiOperation({
    summary: 'Replace the app icon shown on a home screen',
    description:
      'A second image on purpose (E26): a logo is usually wide, and a wide ' +
      'image gets cropped to a square on a home screen. Should be square — ' +
      'nothing here can check that, because this instance ships no image ' +
      'processing library. Without an upload the shipped icons apply, which are ' +
      'drawn as maskable; an uploaded one is declared `any`.',
  })
  @ApiOkResponse({ type: BrandingImagesDto })
  @ApiBadRequestResponse({ description: 'As for the logo.' })
  @ApiPayloadTooLargeResponse({
    description: `An image above ${MAX_BRANDING_BYTES} bytes.`,
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  putAppIcon(
    @UploadedFile() file: MultipartFile | undefined,
  ): Promise<BrandingImagesDto> {
    return this.replace('app-icon', file);
  }

  @Delete('app-icon')
  @ApiOperation({
    summary: 'Remove the app icon',
    description: 'The shipped maskable icons apply again.',
  })
  @ApiOkResponse({ type: BrandingImagesDto })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  deleteAppIcon(): Promise<BrandingImagesDto> {
    return this.branding.remove('app-icon') as Promise<BrandingImagesDto>;
  }

  /**
   * The step both uploads share: there has to be a part at all.
   *
   * Said here rather than in the service, because "you sent no file" is a fact
   * about the request and not about the image. Everything that is a fact about
   * the image — size, type, first bytes — is checked in the service, where a
   * caller that never passed a controller reaches it too.
   */
  private replace(
    kind: BrandingImageKind,
    file: MultipartFile | undefined,
  ): Promise<BrandingImagesDto> {
    if (!file) {
      throw new BadRequestException(
        `Send the image in a multipart part called "${BRANDING_IMAGE_PART}".`,
      );
    }

    return this.branding.replace(kind, {
      mimeType: file.mimetype,
      bytes: file.buffer,
    }) as Promise<BrandingImagesDto>;
  }
}
