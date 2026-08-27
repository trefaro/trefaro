import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MEDIA_LINKS_MODULE_KEY } from '@trefaro/shared-models';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import { CreateMediaLinkDto } from './dto/create-media-link.dto';
import { MediaLinkDto } from './dto/media-link.dto';
import { MediaLinksService } from './media-links.service';

/**
 * The media links of one event, as the organizer maintains them (FR 3.6, F10).
 *
 * Nested under the event, because a link belongs to exactly one event and which
 * sessions it may name is decided by that event's programme. Changing or
 * removing a single link is addressed by its own id instead — see
 * {@link AdminMediaLinksController}.
 *
 * Behind the administrative guard by virtue of its path (E16), and behind
 * {@link CoreModuleEnabledGuard} because `media-links` is a core module an
 * organization may switch off (FR 1.5): switched off, this answers 404 (F53).
 */
@ApiTags('media-links')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(MEDIA_LINKS_MODULE_KEY)
@Controller('admin/events/:eventId/media-links')
export class AdminEventMediaLinksController {
  constructor(private readonly mediaLinks: MediaLinksService) {}

  @Get()
  @ApiOperation({
    summary: 'This event’s media links, in the order they are shown',
    description:
      'Sorted by kind — stream, recording, material — and within a kind by the ' +
      'order they were added. There is no reorder endpoint: a position column ' +
      'beside that would be a second ordering nobody maintains (F52).',
  })
  @ApiOkResponse({ type: [MediaLinkDto] })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({
    description: 'No event with that id — or the module is switched off.',
  })
  list(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<MediaLinkDto[]> {
    return this.mediaLinks.listForOrganizer(eventId) as Promise<MediaLinkDto[]>;
  }

  @Post()
  @ApiOperation({
    summary: 'Add a stream, recording or material link',
    description:
      'Only `http` and `https` addresses, and a session named here has to ' +
      'belong to this event. Nothing is uploaded and nothing is fetched: the ' +
      'title is what the organizer typed (F10, F51).',
  })
  @ApiCreatedResponse({ type: MediaLinkDto })
  @ApiBadRequestResponse({
    description: 'Not a web address, or a session of another event.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({
    description: 'No event with that id — or the module is switched off.',
  })
  @ApiConflictResponse({ description: 'This event holds too many links.' })
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: CreateMediaLinkDto,
  ): Promise<MediaLinkDto> {
    return this.mediaLinks.create(eventId, body) as Promise<MediaLinkDto>;
  }
}
