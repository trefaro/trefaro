import {
  Controller,
  Get,
  Header,
  Headers,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { TranslationCatalogue } from '@trefaro/shared-models';
import type { Response } from 'express';
import { CatalogueService } from './catalogue.service';

/**
 * The user interface's own text, as data (E22).
 *
 * Public and outside both namespaces, like `/api/config` and for the same
 * reason: the participant start page and every event landing page work without a
 * login, so their text has to be fetchable without one. It is also the second
 * request either client makes — after the configuration, which is what tells it
 * which languages exist.
 *
 * Revalidated rather than cached: the whole point of E22 is that an organization
 * changes a word and sees it after a reload, so a long `max-age` would defeat the
 * feature it serves. `no-cache` means "ask every time", not "do not store" — the
 * ETag then usually turns that question into a 304 with no body, which is the
 * cheap outcome for a payload that changes rarely and is fetched on every start.
 */
@ApiTags('configuration')
@Controller('i18n')
export class I18nController {
  constructor(private readonly catalogues: CatalogueService) {}

  @Get(':locale')
  @Header('Cache-Control', 'no-cache, must-revalidate')
  @ApiOperation({
    summary: 'The translation catalogue of one language',
    description:
      'Flat JSON: one string per dotted key. Answers the catalogue shipped ' +
      'with this image for that language, with the keys English has, overlaid ' +
      "with this instance's own translations (E22). A key the language does " +
      'not translate carries the English text, so a caller never has to ' +
      'handle a gap (E23). Requires no authentication.',
  })
  @ApiParam({
    name: 'locale',
    description:
      'A BCP 47 tag this instance serves — one it ships, or one an ' +
      'administrator has put in `availableLocales`.',
    example: 'de',
  })
  @ApiOkResponse({
    description: 'The catalogue.',
    schema: {
      type: 'object',
      additionalProperties: { type: 'string' },
      example: { 'modules.push.title': 'Push notifications' },
    },
  })
  @ApiNotFoundResponse({
    description: 'This instance does not serve that language.',
  })
  async getCatalogue(
    @Param('locale') locale: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TranslationCatalogue | undefined> {
    // Resolved before the servability check answers 404, because resolving is
    // what rejects a malformed tag — and a tag that cannot be a language should
    // be a 400 rather than "this instance does not serve that language".
    const resolved = await this.catalogues.resolve(locale);

    if (!(await this.catalogues.isServable(resolved.locale))) {
      throw new NotFoundException(
        `This instance does not serve translations for ${resolved.locale}.`,
      );
    }

    response.setHeader('ETag', resolved.etag);

    if (matches(ifNoneMatch, resolved.etag)) {
      response.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }

    return resolved.catalogue;
  }
}

/**
 * Whether the client already holds this catalogue.
 *
 * `If-None-Match` may carry a list and a `W/` prefix, so it is parsed rather
 * than compared: a browser that sends `W/"abc", "def"` must not be told its copy
 * is stale.
 */
function matches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === '*') return true;

  return header
    .split(',')
    .map((candidate) => candidate.trim().replace(/^W\//, ''))
    .includes(etag);
}
