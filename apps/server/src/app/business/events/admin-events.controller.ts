import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UpdateEventDto } from './dto/create-event.dto';
import { OrganizerEventDto } from './dto/event.dto';
import { EventsService } from './events.service';

/**
 * One event, as the organizer manages it (FR 3.2).
 *
 * Addressed by id rather than nested under its series: an event does not move
 * between series, so the id alone identifies it, and the organizer client
 * already holds it. Behind the administrative guard by virtue of its path.
 */
@ApiTags('events')
@Controller('admin/events')
export class AdminEventsController {
  constructor(private readonly events: EventsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'One event' })
  @ApiOkResponse({ type: OrganizerEventDto })
  @ApiNotFoundResponse({ description: 'No event with that id.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<OrganizerEventDto> {
    return this.events.getForOrganizer(id) as Promise<OrganizerEventDto>;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Change an event',
    description:
      'Only the fields sent are written, and they are validated against the ' +
      'resulting event: switching to hybrid and adding the link in one request ' +
      'is accepted, publishing without one is not. The public address stays as ' +
      'it is unless sent explicitly.',
  })
  @ApiOkResponse({ type: OrganizerEventDto })
  @ApiBadRequestResponse({
    description: 'Invalid period, unknown time zone, or not publishable yet.',
  })
  @ApiConflictResponse({ description: 'The address is not usable or taken.' })
  @ApiNotFoundResponse({ description: 'No event with that id.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEventDto,
  ): Promise<OrganizerEventDto> {
    return this.events.update(id, body) as Promise<OrganizerEventDto>;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an event',
    description:
      'For an event created by mistake. An event with confirmed registrations ' +
      'is archived instead — that check arrives with the registrations in AP 4.',
  })
  @ApiNoContentResponse({ description: 'Event deleted.' })
  @ApiNotFoundResponse({ description: 'No event with that id.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.events.delete(id);
  }
}
