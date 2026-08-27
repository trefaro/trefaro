import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MEDIA_LINKS_MODULE_KEY } from '@trefaro/shared-models';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import { UpdateMediaLinkDto } from './dto/create-media-link.dto';
import { MediaLinkDto } from './dto/media-link.dto';
import { MediaLinksService } from './media-links.service';

/**
 * One media link (FR 3.6, F10).
 *
 * Addressed by id rather than nested under its event: a link does not move
 * between events, and the list the organizer is looking at already holds the id.
 *
 * Behind the administrative guard by virtue of its path (E16) and behind the
 * core module's own guard (F53).
 */
@ApiTags('media-links')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(MEDIA_LINKS_MODULE_KEY)
@Controller('admin/media-links')
export class AdminMediaLinksController {
  constructor(private readonly mediaLinks: MediaLinksService) {}

  @Patch(':id')
  @ApiOperation({
    summary: 'Change a link — its kind, title, address or session',
    description:
      'Nothing about a link is fixed after creation: no answer, seat or file ' +
      'refers to one, so a recording that turns out to sit elsewhere is an ' +
      'edit rather than a delete and a re-create.',
  })
  @ApiOkResponse({ type: MediaLinkDto })
  @ApiBadRequestResponse({
    description: 'Not a web address, or a session of another event.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({
    description: 'No media link with that id — or the module is switched off.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMediaLinkDto,
  ): Promise<MediaLinkDto> {
    return this.mediaLinks.update(id, body) as Promise<MediaLinkDto>;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a link',
    description:
      'No archiving rule of its own (unlike an event, E14): a link is a ' +
      'pointer, and the media it points at was never ours to keep (F10).',
  })
  @ApiNoContentResponse({ description: 'Removed.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({
    description: 'No media link with that id — or the module is switched off.',
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.mediaLinks.delete(id);
  }
}
