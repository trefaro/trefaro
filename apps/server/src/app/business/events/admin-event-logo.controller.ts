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
  LOGO_UPLOAD_OPTIONS,
  LogoImageDto,
  LogoImageUploadDto,
  type LogoMultipartFile,
} from '../logo-files';
import { EventsService } from './events.service';

/**
 * Uploading and removing the logo of one event (FR 3.1, P1).
 *
 * The series' twin, and deliberately a separate class rather than one controller
 * with the kind as a parameter: the routing table then says which two things
 * have a logo, and each service keeps its own 404. The same reasoning that
 * spells out `logo` and `app-icon` as two branding routes.
 *
 * Under `/api/admin/events` and therefore behind the administrative session by
 * virtue of its path (E16).
 */
@ApiTags('events')
@Controller('admin/events')
export class AdminEventLogoController {
  constructor(private readonly events: EventsService) {}

  @Put(':id/logo')
  @UseInterceptors(FileInterceptor(BRANDING_IMAGE_PART, LOGO_UPLOAD_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: LogoImageUploadDto })
  @ApiOperation({
    summary: 'Replace the logo of an event',
    description:
      'Served publicly, so the event landing page can show it ' +
      `without a login. Accepts ${brandingTypeSummary()} up to ` +
      `${MAX_BRANDING_BYTES} bytes; the type is checked against the file's own ` +
      'first bytes. Written immediately — it is not part of the event form and ' +
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
  @ApiNotFoundResponse({ description: 'No event has that id.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  async put(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: LogoMultipartFile | undefined,
  ): Promise<LogoImageDto> {
    if (!file) {
      throw new BadRequestException(
        `Send the image in a multipart part called "${BRANDING_IMAGE_PART}".`,
      );
    }

    return {
      logoUrl: await this.events.setLogo(id, {
        mimeType: file.mimetype,
        bytes: file.buffer,
      }),
    };
  }

  @Delete(':id/logo')
  @ApiOperation({
    summary: 'Remove the logo of an event',
    description:
      'The landing page then carries only the organization logo in the header — ' +
      'an event does not inherit the logo of its series. The file is removed ' +
      'from the upload volume.',
  })
  @ApiOkResponse({ type: LogoImageDto })
  @ApiNotFoundResponse({ description: 'No event has that id.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<LogoImageDto> {
    return { logoUrl: await this.events.removeLogo(id) };
  }
}
