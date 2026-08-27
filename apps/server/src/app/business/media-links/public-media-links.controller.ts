import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MEDIA_LINKS_MODULE_KEY } from '@trefaro/shared-models';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import { PublicMediaLinkDto } from './dto/media-link.dto';
import { MediaLinksService } from './media-links.service';

/**
 * The media links a participant reads on the landing page (FR 3.6, F10).
 *
 * Without a login, under the event's public address, exactly like the programme:
 * a stream link is what somebody follows to attend an online event, and a
 * recording is what they come back for. Its own request rather than part of the
 * event, for the same reason the programme is — what the page has to answer
 * first is "what is this, when, where".
 *
 * 404 while the module is switched off (F53), which is the same answer the page
 * gets for an event that is not published: nothing to render, no explanation of
 * what the instance has switched off.
 */
@ApiTags('media-links')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(MEDIA_LINKS_MODULE_KEY)
@Controller('user/series/:seriesSlug/events/:eventSlug/media-links')
export class PublicMediaLinksController {
  constructor(private readonly mediaLinks: MediaLinksService) {}

  @Get()
  @ApiOperation({
    summary: 'This event’s stream, recording and material links',
    description:
      'Grouped by the client: links with a `programItemId` are rendered with ' +
      'their session, the rest as the event’s own media section. Addresses are ' +
      'rendered as links, never embedded (F51).',
  })
  @ApiOkResponse({ type: [PublicMediaLinkDto] })
  @ApiNotFoundResponse({
    description: 'No published event at that address, or the module is off.',
  })
  list(
    @Param('seriesSlug') seriesSlug: string,
    @Param('eventSlug') eventSlug: string,
  ): Promise<PublicMediaLinkDto[]> {
    return this.mediaLinks.listPublic(seriesSlug, eventSlug) as Promise<
      PublicMediaLinkDto[]
    >;
  }
}
