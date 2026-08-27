import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PublicProgramItemDto } from './dto/program-item.dto';
import { ProgramService } from './program.service';

/**
 * The programme a participant reads on the landing page (FR 3.6, FR 3.7).
 *
 * Without a login: the programme is part of what somebody needs in order to
 * decide whether to come, and the landing page is what a shared link points at.
 * Under the event's public address, which is unique per series rather than per
 * instance (E7, F28).
 *
 * Its own request rather than part of the event: the two are read at different
 * moments and the event is what the page renders first.
 */
@ApiTags('program')
@Controller('user/series/:seriesSlug/events/:eventSlug/program')
export class PublicProgramController {
  constructor(private readonly program: ProgramService) {}

  @Get()
  @ApiOperation({
    summary: 'This event’s programme, in the order it happens',
    description:
      'Times are absolute instants; they are rendered in the event’s zone, not ' +
      'the reader’s (E8). No ids of anything but the items themselves — a room ' +
      'is the room planning plug-in’s to answer for (F21).',
  })
  @ApiOkResponse({ type: [PublicProgramItemDto] })
  @ApiNotFoundResponse({ description: 'No published event at that address.' })
  list(
    @Param('seriesSlug') seriesSlug: string,
    @Param('eventSlug') eventSlug: string,
  ): Promise<PublicProgramItemDto[]> {
    return this.program.listPublic(seriesSlug, eventSlug) as Promise<
      PublicProgramItemDto[]
    >;
  }
}
