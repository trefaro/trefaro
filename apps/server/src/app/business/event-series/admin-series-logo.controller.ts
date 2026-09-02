import {
  BadRequestException,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  BRANDING_IMAGE_PART,
  MAX_BRANDING_BYTES,
  brandingTypeSummary,
} from '@trefaro/shared-models';
import {
  IMAGE_UPLOAD_OPTIONS,
  type ImageMultipartFile,
} from '../common/image-upload';
import { LogoImageDto, LogoImageUploadDto } from '../logo-files';
import { EventSeriesService } from './event-series.service';

/**
 * Uploading and removing the logo of one series (FR 2.1, P1).
 *
 * A controller of its own next to `AdminEventSeriesController`, the same way
 * `AdminBrandingController` sits next to the settings controller: a multipart
 * upload has nothing in common with a JSON form body, and the pair of them in
 * one class would mean one class with two request shapes and two error
 * vocabularies.
 *
 * Under `/api/admin/series` and therefore behind the administrative session by
 * virtue of its path (E16), with no decorator to forget.
 *
 * `PUT` rather than `POST`: a series has exactly one logo, and uploading twice
 * replaces rather than accumulates.
 */
@ApiTags('event series')
@Controller('admin/series')
export class AdminSeriesLogoController {
  constructor(private readonly series: EventSeriesService) {}

  @Put(':id/logo')
  @UseInterceptors(FileInterceptor(BRANDING_IMAGE_PART, IMAGE_UPLOAD_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: LogoImageUploadDto })
  @ApiOperation({
    summary: 'Replace the logo of a series',
    description:
      'Served publicly, so the start page and the series page can show it ' +
      `without a login. Accepts ${brandingTypeSummary()} up to ` +
      `${MAX_BRANDING_BYTES} bytes; the type is checked against the file's own ` +
      'first bytes. Written immediately — it is not part of the series form and ' +
      'not covered by cancelling it.',
  })
  @ApiOkResponse({ type: LogoImageDto })
  @ApiBadRequestResponse({
    description:
      'No file, an empty one, a type that is not accepted, or bytes that do ' +
      'not match the declared type.',
  })
  @ApiPayloadTooLargeResponse({
    description: `An image above ${MAX_BRANDING_BYTES} bytes.`,
  })
  @ApiNotFoundResponse({ description: 'No series has that id.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  async put(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: ImageMultipartFile | undefined,
  ): Promise<LogoImageDto> {
    if (!file) {
      throw new BadRequestException(
        `Send the image in a multipart part called "${BRANDING_IMAGE_PART}".`,
      );
    }

    return {
      logoUrl: await this.series.setLogo(id, {
        mimeType: file.mimetype,
        bytes: file.buffer,
      }),
    };
  }

  @Delete(':id/logo')
  @ApiOperation({
    summary: 'Remove the logo of a series',
    description:
      'The start page and the series page then carry only the organization logo ' +
      'in the header. The file is removed from the upload volume.',
  })
  @ApiOkResponse({ type: LogoImageDto })
  @ApiNotFoundResponse({ description: 'No series has that id.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<LogoImageDto> {
    return { logoUrl: await this.series.removeLogo(id) };
  }
}
