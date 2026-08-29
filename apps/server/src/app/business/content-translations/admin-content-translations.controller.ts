import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ContentTranslationsService } from './content-translations.service';
import {
  EventSeriesTranslationDto,
  EventSeriesTranslationsDto,
  EventTranslationDto,
  EventTranslationsDto,
  ProgramItemTranslationDto,
  ProgramItemTranslationsDto,
} from './dto/content-translation.dto';

/**
 * Translating what an organization writes (FR 3.12, UC 12).
 *
 * Three controllers rather than one, because a translation is addressed under
 * the thing it translates and a NestJS controller has one base path. They share
 * one service, one set of rules and this comment.
 *
 * Behind the administrative guard by virtue of their paths — every route below
 * `admin/` is (E16).
 *
 * The shape is the same three times:
 *
 * - **`GET …/translations`** — the whole screen in one answer: what the thing
 *   says, and what it says in every language it has been given (F49).
 * - **`PUT …/translations/:locale`** — one language of one thing, replacing what
 *   was there. A field the request leaves out is a field the translator cleared,
 *   and a translation with nothing left in it deletes its row rather than
 *   storing a row that says nothing (F74's rule, applied to content).
 * - **`DELETE …/translations/:locale`** — the same removal, said outright.
 *   Idempotent: deleting a translation that is not there is not an error, it is
 *   the state the caller asked for.
 *
 * Any well-formed language tag is accepted, offered by this instance or not
 * (E30): a language is created by translating it, and requiring it to be on
 * offer first would mean showing visitors a language before its first word
 * exists.
 */
@ApiTags('content translations')
@Controller('admin/series/:id/translations')
export class AdminSeriesTranslationsController {
  constructor(private readonly translations: ContentTranslationsService) {}

  @Get()
  @ApiOperation({ summary: 'What a series says, in every language it has' })
  @ApiOkResponse({ type: EventSeriesTranslationsDto })
  @ApiNotFoundResponse({ description: 'No series with that id.' })
  get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EventSeriesTranslationsDto> {
    return this.translations.forSeries(
      id,
    ) as Promise<EventSeriesTranslationsDto>;
  }

  @Put(':locale')
  @ApiOperation({ summary: 'Write one language of a series (FR 3.12)' })
  @ApiParam({ name: 'locale', example: 'de' })
  @ApiOkResponse({ type: EventSeriesTranslationDto })
  @ApiBadRequestResponse({
    description: 'Not a language tag, or a text too long.',
  })
  @ApiNotFoundResponse({ description: 'No series with that id.' })
  write(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale') locale: string,
    @Body() body: EventSeriesTranslationDto,
  ): Promise<EventSeriesTranslationDto> {
    return this.translations.writeSeries(
      id,
      locale,
      body,
    ) as Promise<EventSeriesTranslationDto>;
  }

  @Delete(':locale')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove one language of a series' })
  @ApiParam({ name: 'locale', example: 'de' })
  @ApiNoContentResponse({
    description: 'Gone, including when there was nothing to remove.',
  })
  @ApiNotFoundResponse({ description: 'No series with that id.' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale') locale: string,
  ): Promise<void> {
    return this.translations.removeSeries(id, locale);
  }
}

/** See {@link AdminSeriesTranslationsController} for the shape and the rules. */
@ApiTags('content translations')
@Controller('admin/events/:id/translations')
export class AdminEventTranslationsController {
  constructor(private readonly translations: ContentTranslationsService) {}

  @Get()
  @ApiOperation({
    summary: 'What an event and its programme say, in every language they have',
    description:
      'One request for one screen: an organizer translating an event does the ' +
      'header and the sessions in one sitting.',
  })
  @ApiOkResponse({ type: EventTranslationsDto })
  @ApiNotFoundResponse({ description: 'No event with that id.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<EventTranslationsDto> {
    return this.translations.forEvent(id) as Promise<EventTranslationsDto>;
  }

  @Put(':locale')
  @ApiOperation({ summary: 'Write one language of an event (FR 3.12)' })
  @ApiParam({ name: 'locale', example: 'de' })
  @ApiOkResponse({ type: EventTranslationDto })
  @ApiBadRequestResponse({
    description: 'Not a language tag, or a text too long.',
  })
  @ApiNotFoundResponse({ description: 'No event with that id.' })
  write(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale') locale: string,
    @Body() body: EventTranslationDto,
  ): Promise<EventTranslationDto> {
    return this.translations.writeEvent(
      id,
      locale,
      body,
    ) as Promise<EventTranslationDto>;
  }

  @Delete(':locale')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove one language of an event' })
  @ApiParam({ name: 'locale', example: 'de' })
  @ApiNoContentResponse({
    description: 'Gone, including when there was nothing to remove.',
  })
  @ApiNotFoundResponse({ description: 'No event with that id.' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale') locale: string,
  ): Promise<void> {
    return this.translations.removeEvent(id, locale);
  }
}

/** See {@link AdminSeriesTranslationsController} for the shape and the rules. */
@ApiTags('content translations')
@Controller('admin/program-items/:id/translations')
export class AdminProgramItemTranslationsController {
  constructor(private readonly translations: ContentTranslationsService) {}

  @Get()
  @ApiOperation({ summary: 'What a session says, in every language it has' })
  @ApiOkResponse({ type: ProgramItemTranslationsDto })
  @ApiNotFoundResponse({ description: 'No session with that id.' })
  get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProgramItemTranslationsDto> {
    return this.translations.forProgramItem(
      id,
    ) as Promise<ProgramItemTranslationsDto>;
  }

  @Put(':locale')
  @ApiOperation({ summary: 'Write one language of a session (FR 3.12)' })
  @ApiParam({ name: 'locale', example: 'de' })
  @ApiOkResponse({ type: ProgramItemTranslationDto })
  @ApiBadRequestResponse({
    description: 'Not a language tag, or a text too long.',
  })
  @ApiNotFoundResponse({ description: 'No session with that id.' })
  write(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale') locale: string,
    @Body() body: ProgramItemTranslationDto,
  ): Promise<ProgramItemTranslationDto> {
    return this.translations.writeProgramItem(
      id,
      locale,
      body,
    ) as Promise<ProgramItemTranslationDto>;
  }

  @Delete(':locale')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove one language of a session' })
  @ApiParam({ name: 'locale', example: 'de' })
  @ApiNoContentResponse({
    description: 'Gone, including when there was nothing to remove.',
  })
  @ApiNotFoundResponse({ description: 'No session with that id.' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locale') locale: string,
  ): Promise<void> {
    return this.translations.removeProgramItem(id, locale);
  }
}
