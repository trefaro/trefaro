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
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateEventSeriesDto,
  UpdateEventSeriesDto,
} from './dto/create-event-series.dto';
import { EventSeriesDto } from './dto/event-series.dto';
import { EventSeriesService } from './event-series.service';

/**
 * Event series as the organizer manages them (UC 02, UC 03, FR 2.1, FR 2.2).
 *
 * Behind the administrative guard by virtue of its path — every route below
 * `admin/` is (see `AdminGuard`).
 */
@ApiTags('event series')
@Controller('admin/series')
export class AdminEventSeriesController {
  constructor(private readonly series: EventSeriesService) {}

  @Get()
  @ApiOperation({
    summary: 'All event series, including drafts and archived ones',
  })
  @ApiOkResponse({ type: [EventSeriesDto] })
  list(): Promise<readonly EventSeriesDto[]> {
    return this.series.listForOrganizer() as Promise<readonly EventSeriesDto[]>;
  }

  @Get(':id')
  @ApiOperation({ summary: 'One event series' })
  @ApiOkResponse({ type: EventSeriesDto })
  @ApiNotFoundResponse({ description: 'No series with that id.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<EventSeriesDto> {
    return this.series.getForOrganizer(id) as Promise<EventSeriesDto>;
  }

  @Post()
  @ApiOperation({ summary: 'Create an event series' })
  @ApiCreatedResponse({ type: EventSeriesDto })
  @ApiConflictResponse({ description: 'The address is not usable or taken.' })
  create(@Body() body: CreateEventSeriesDto): Promise<EventSeriesDto> {
    return this.series.create(body) as Promise<EventSeriesDto>;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Change an event series',
    description:
      'Only the fields sent are written. The public address stays as it is ' +
      'unless it is sent explicitly, so renaming a series does not break links ' +
      'that are already out there.',
  })
  @ApiOkResponse({ type: EventSeriesDto })
  @ApiNotFoundResponse({ description: 'No series with that id.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEventSeriesDto,
  ): Promise<EventSeriesDto> {
    return this.series.update(id, body) as Promise<EventSeriesDto>;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an event series',
    description:
      'For a series that was created by mistake. A series that has events, and ' +
      'therefore registrations, is archived instead — that check arrives with ' +
      'the events in AP 3.',
  })
  @ApiNoContentResponse({ description: 'Series deleted.' })
  @ApiNotFoundResponse({ description: 'No series with that id.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.series.delete(id);
  }
}
