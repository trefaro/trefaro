import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateEventDto } from './dto/create-event.dto';
import { OrganizerEventDto } from './dto/event.dto';
import { EventsService } from './events.service';

/**
 * The events of one series (FR 2.3, FR 3.1).
 *
 * Nested under the series because that is the only place a new event can come
 * from — an event without a series has nothing to belong to.
 */
@ApiTags('events')
@Controller('admin/series/:seriesId/events')
export class AdminSeriesEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiOperation({
    summary: 'All events of a series, in date order, drafts included',
  })
  @ApiOkResponse({ type: [OrganizerEventDto] })
  @ApiNotFoundResponse({ description: 'No series with that id.' })
  list(
    @Param('seriesId', ParseUUIDPipe) seriesId: string,
  ): Promise<readonly OrganizerEventDto[]> {
    return this.events.listForOrganizer(seriesId) as Promise<
      readonly OrganizerEventDto[]
    >;
  }

  @Post()
  @ApiOperation({ summary: 'Create an event in this series' })
  @ApiCreatedResponse({ type: OrganizerEventDto })
  @ApiBadRequestResponse({
    description: 'Invalid period, unknown time zone, or not publishable yet.',
  })
  @ApiConflictResponse({ description: 'The address is not usable or taken.' })
  @ApiNotFoundResponse({ description: 'No series with that id.' })
  create(
    @Param('seriesId', ParseUUIDPipe) seriesId: string,
    @Body() body: CreateEventDto,
  ): Promise<OrganizerEventDto> {
    return this.events.create(seriesId, body) as Promise<OrganizerEventDto>;
  }
}
