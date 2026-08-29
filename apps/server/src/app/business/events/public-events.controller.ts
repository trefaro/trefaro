import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiLocaleQuery, LocaleQueryPipe } from '../common/locale-query.pipe';
import { PublicEventDto } from './dto/event.dto';
import { EventsService } from './events.service';

/**
 * Events as a participant sees them — the landing page (FR 3.6, FR 2.3).
 *
 * No login: the event landing page is the low entry threshold the thesis asks
 * for, and it is what a shared link points at. Nothing about participants
 * appears here; only what the organization has published.
 */
@ApiTags('events')
@Controller('user/series/:seriesSlug/events')
export class PublicEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiOperation({
    summary: 'Published events of a published series, in date order',
    description:
      'Requires no authentication. Upcoming and past together (FR 2.3).',
  })
  @ApiLocaleQuery()
  @ApiOkResponse({ type: [PublicEventDto] })
  @ApiNotFoundResponse({ description: 'No published series at that address.' })
  list(
    @Param('seriesSlug') seriesSlug: string,
    @Query('locale', LocaleQueryPipe) locale?: string,
  ): Promise<readonly PublicEventDto[]> {
    return this.events.listPublic(seriesSlug, locale) as Promise<
      readonly PublicEventDto[]
    >;
  }

  @Get(':eventSlug')
  @ApiOperation({ summary: 'One published event, by its address' })
  @ApiLocaleQuery()
  @ApiOkResponse({ type: PublicEventDto })
  @ApiNotFoundResponse({
    description:
      'No published event at that address. A draft event, and any event of a ' +
      'series that is not public, answer the same way — an unannounced event ' +
      'stays unannounced.',
  })
  get(
    @Param('seriesSlug') seriesSlug: string,
    @Param('eventSlug') eventSlug: string,
    @Query('locale', LocaleQueryPipe) locale?: string,
  ): Promise<PublicEventDto> {
    return this.events.getPublic(
      seriesSlug,
      eventSlug,
      locale,
    ) as Promise<PublicEventDto>;
  }
}
