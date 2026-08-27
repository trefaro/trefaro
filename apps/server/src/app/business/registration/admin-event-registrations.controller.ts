import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ListParticipantsDto } from './dto/list-participants.dto';
import {
  ParticipantPageDto,
  RegistrationStatisticsDto,
} from './dto/participant.dto';
import { ParticipantsService } from './participants.service';

/**
 * The participant overview of one event (UC 08, FR 3.3).
 *
 * The highest rated function of the survey (3,86/4), and the screen the phase
 * plan expects to fail first at volume — which is why there is no endpoint here
 * that returns every registration of an event. Reading a whole event means
 * asking for its pages.
 *
 * Behind the administrative guard by virtue of its path (E16).
 */
@ApiTags('participants')
@Controller('admin/events/:eventId/registrations')
export class AdminEventRegistrationsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Get()
  @ApiOperation({
    summary: "One page of an event's participants",
    description:
      'Searchable over name and e-mail, filterable by status, sortable, and ' +
      'always paged. The e-mail address is part of every row (E13).',
  })
  @ApiOkResponse({ type: ParticipantPageDto })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No event with that id.' })
  list(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: ListParticipantsDto,
  ): Promise<ParticipantPageDto> {
    return this.participants.list(
      eventId,
      query,
    ) as Promise<ParticipantPageDto>;
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Registrations per calendar week',
    description:
      "Weeks are cut in the event's own time zone (E8) and quiet weeks are " +
      'included, so the curve does not turn a lull into a plateau. This is the ' +
      'data behind the graph in the mockups.',
  })
  @ApiOkResponse({ type: RegistrationStatisticsDto })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No event with that id.' })
  statistics(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<RegistrationStatisticsDto> {
    return this.participants.statistics(
      eventId,
    ) as Promise<RegistrationStatisticsDto>;
  }
}
