import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EventDashboardDto } from './dto/event-dashboard.dto';
import { EventDashboardService } from './event-dashboard.service';

/**
 * The dashboard of one event (UC 05, FR 3.8).
 *
 * One request for one screen: the tiles and the latest registrations arrive
 * together, so a dashboard does not fill in tile by tile as four requests come
 * back — and so the client never downloads rows in order to count them.
 *
 * Behind the administrative guard by virtue of its path (E16).
 */
@ApiTags('events')
@Controller('admin/events/:eventId/dashboard')
export class AdminEventDashboardController {
  constructor(private readonly dashboard: EventDashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Everything the event dashboard shows',
    description:
      'Registration counts by status, the five newest registrations, how ' +
      'full the programme is and how many questions the registration form ' +
      'asks. Tiles for modules that do not exist yet (messages in phase 3, ' +
      'programme proposals and the forum in phase 4) are absent rather than ' +
      'zero: a zero is a statement about data, and a dashboard full of them ' +
      'teaches an organizer to ignore it.',
  })
  @ApiOkResponse({ type: EventDashboardDto })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No event with that id.' })
  forEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<EventDashboardDto> {
    return this.dashboard.forEvent(eventId) as Promise<EventDashboardDto>;
  }
}
