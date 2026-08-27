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
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateProgramItemDto } from './dto/create-program-item.dto';
import { ProgramItemDto } from './dto/program-item.dto';
import { ProgramService } from './program.service';

/**
 * The programme of one event, as the organizer plans it (FR 3.7).
 *
 * Nested under the event, because an item belongs to exactly one programme and
 * whether it fits is decided by that event's period. Changing or removing a
 * single item is addressed by its own id instead — see
 * {@link AdminProgramItemsController}.
 *
 * There is no reorder endpoint here, unlike the registration form: a programme
 * is ordered by the clock (F40), so moving a session is changing its time.
 *
 * Behind the administrative guard by virtue of its path (E16).
 */
@ApiTags('program')
@Controller('admin/events/:eventId/program-items')
export class AdminEventProgramItemsController {
  constructor(private readonly program: ProgramService) {}

  @Get()
  @ApiOperation({
    summary: 'This event’s programme, in the order it happens',
    description:
      'Overlapping items are returned as they are (F41): parallel sessions are ' +
      'what a two-track conference is, and only a person can tell one from a ' +
      'clash. The organizer’s view marks them.',
  })
  @ApiOkResponse({ type: [ProgramItemDto] })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No event with that id.' })
  list(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<ProgramItemDto[]> {
    return this.program.listForOrganizer(eventId) as Promise<ProgramItemDto[]>;
  }

  @Post()
  @ApiOperation({
    summary: 'Add a session to the programme',
    description:
      'The item has to happen while the event does, and it has to have a ' +
      'length. Both are refused with 400 rather than silently clamped — a ' +
      'session on the wrong day is a typo, and moving it quietly would hide it.',
  })
  @ApiCreatedResponse({ type: ProgramItemDto })
  @ApiBadRequestResponse({
    description: 'Outside the event’s period, or ending before it starts.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No event with that id.' })
  @ApiConflictResponse({ description: 'The programme is full.' })
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: CreateProgramItemDto,
  ): Promise<ProgramItemDto> {
    return this.program.create(eventId, body) as Promise<ProgramItemDto>;
  }
}
