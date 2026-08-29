import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  LocaleCatalogueDetailDto,
  LocaleOverviewDto,
  TranslationWriteDto,
  TranslationWriteResultDto,
} from './dto/translation.dto';
import { TranslationAdminService } from './translation-admin.service';

/**
 * The language administration (chapter 4, FR 1.4) — AP 7.
 *
 * Behind the administrative session by virtue of its path (E16). Deliberately
 * separate from `/api/i18n/:locale`, which is public: one endpoint answers "what
 * should this client render", the other "how far has this translation got and
 * what did the image ship" — and the second must never be a way to enumerate
 * anything without a session.
 *
 * Which languages are *offered* is not here but on
 * `PUT /api/admin/config/locales`: `active_locales` and `default_locale` are
 * columns of the configuration, and an endpoint under `/api/admin/i18n` that
 * wrote them would be a second writer of one row. This side owns the
 * translations; that side owns the two decisions about them (E30).
 */
@ApiTags('i18n')
@Controller('admin/i18n')
export class I18nAdminController {
  constructor(private readonly translations: TranslationAdminService) {}

  @Get()
  @ApiOperation({
    summary: 'Every language this instance knows, with its completeness figure',
    description:
      'The union of what the image ships, what the organization offers and ' +
      'what somebody has already translated — so a half-finished language is ' +
      'visible on the screen that is meant to finish it (E23, E30).',
  })
  @ApiOkResponse({ type: LocaleOverviewDto })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  overview(): Promise<LocaleOverviewDto> {
    return this.translations.overview() as Promise<LocaleOverviewDto>;
  }

  @Get(':locale')
  @ApiOperation({
    summary: 'One language, key by key, with the shipped text beside each',
    description:
      'Answers for a language nothing knows yet as well: every key `missing`, ' +
      'the figure zero. That is how a third language starts — a 404 here would ' +
      'force an organization to offer a language to its visitors before it ' +
      'could translate the first word of it.',
  })
  @ApiParam({ name: 'locale', example: 'de' })
  @ApiOkResponse({ type: LocaleCatalogueDetailDto })
  @ApiBadRequestResponse({ description: 'Not a BCP 47 language tag.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  detail(@Param('locale') locale: string): Promise<LocaleCatalogueDetailDto> {
    return this.translations.detail(
      locale,
    ) as Promise<LocaleCatalogueDetailDto>;
  }

  @Put(':locale')
  @ApiOperation({
    summary: 'Write the organization’s own text for one or many keys',
    description:
      'A merge: keys that are sent are written, keys that are absent stay as ' +
      'they were. So the same endpoint saves one edited key and imports a ' +
      'whole translated file. An empty value resets a key, and a value equal ' +
      'to the shipped text stores no row — it would only pin the wording ' +
      'against the next image.',
  })
  @ApiParam({ name: 'locale', example: 'de' })
  @ApiOkResponse({ type: TranslationWriteResultDto })
  @ApiBadRequestResponse({
    description:
      'Not a language tag, an empty body, more keys than one write may carry, ' +
      'a value that is not a string, or a value longer than the column allows.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  write(
    @Param('locale') locale: string,
    @Body() body: TranslationWriteDto,
  ): Promise<TranslationWriteResultDto> {
    return this.translations.write(
      locale,
      body.entries,
    ) as Promise<TranslationWriteResultDto>;
  }

  @Delete(':locale/:key')
  @ApiOperation({
    summary: 'Reset one key to what the image ships',
    description:
      'The same operation as writing an empty value, and one code path — two ' +
      'would be two answers to what "reset" means. Deletes only the ' +
      'organization’s row; the shipped text cannot be deleted.',
  })
  @ApiParam({ name: 'locale', example: 'de' })
  @ApiParam({ name: 'key', example: 'modules.push.title' })
  @ApiOkResponse({ type: TranslationWriteResultDto })
  @ApiBadRequestResponse({ description: 'Not a BCP 47 language tag.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  reset(
    @Param('locale') locale: string,
    @Param('key') key: string,
  ): Promise<TranslationWriteResultDto> {
    return this.translations.reset(
      locale,
      key,
    ) as Promise<TranslationWriteResultDto>;
  }
}
