import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiLocaleQuery, LocaleQueryPipe } from '../common/locale-query.pipe';
import { PublicEventSeriesDto } from './dto/event-series.dto';
import { EventSeriesService } from './event-series.service';

/**
 * Event series as a participant sees them (UC 08 start page).
 *
 * No login: the start page and the event landing page are the low entry
 * threshold the thesis asks for. Nothing here may carry anything about
 * participants — only what the organization has published.
 */
@ApiTags('event series')
@Controller('user/series')
export class PublicEventSeriesController {
  constructor(private readonly series: EventSeriesService) {}

  @Get()
  @ApiOperation({
    summary: 'Published event series',
    description: 'The participant start page. Requires no authentication.',
  })
  @ApiLocaleQuery()
  @ApiOkResponse({ type: [PublicEventSeriesDto] })
  list(
    @Query('locale', LocaleQueryPipe) locale?: string,
  ): Promise<readonly PublicEventSeriesDto[]> {
    return this.series.listPublic(locale) as Promise<
      readonly PublicEventSeriesDto[]
    >;
  }

  @Get(':slug')
  @ApiOperation({ summary: 'One published event series, by its address' })
  @ApiLocaleQuery()
  @ApiOkResponse({ type: PublicEventSeriesDto })
  @ApiNotFoundResponse({
    description:
      'No published series at that address. A draft answers the same way, so an ' +
      'unannounced series stays unannounced.',
  })
  get(
    @Param('slug') slug: string,
    @Query('locale', LocaleQueryPipe) locale?: string,
  ): Promise<PublicEventSeriesDto> {
    return this.series.getPublicBySlug(
      slug,
      locale,
    ) as Promise<PublicEventSeriesDto>;
  }
}
