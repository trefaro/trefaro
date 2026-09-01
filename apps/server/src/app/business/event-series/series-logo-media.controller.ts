import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { EventSeriesService } from './event-series.service';

/**
 * A year. Safe only because the URL carries `?v=<updated_at>`, so a changed
 * image is a changed URL — the argument is in `logo-files/logo-url.ts`.
 */
const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * The public logo of one series (FR 2.1, E19).
 *
 * The second public route to bytes stored by this instance, after the two
 * branding ones, and it can exist next to E9 for the same reason: it takes no
 * *path* from its caller. The id names a row; what that row's logo resolves to
 * is not the caller's to choose, and a registration attachment cannot be named
 * here because no file can be named here.
 *
 * Outside `/api/user` and `/api/admin` on purpose: the participant start page
 * and every series page are public and both show this image before anyone has
 * logged in.
 *
 * The two headers are the pair the branding routes and the attachment download
 * carry, for the same reasons: the type of these bytes is decided by their own
 * first bytes (F38), which a browser that sniffs the answer would undo; and if
 * somebody navigates straight to the URL, nothing that comes back may load or
 * run anything.
 */
@ApiTags('event series')
@Controller('media/series')
export class SeriesLogoMediaController {
  constructor(private readonly series: EventSeriesService) {}

  @Get(':id/logo')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  @ApiOperation({
    summary: 'The logo of a series',
    description:
      'Public, so the start page and the series page can show it. Answers 404 ' +
      'while the series has no logo, and for an id that does not exist. The URL ' +
      'to use is the `logoUrl` of the series itself, with a `?v=` that changes ' +
      'whenever the row does — this answer is cached for a year.',
  })
  @ApiOkResponse({
    description: 'The image.',
    content: { 'image/png': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiNotFoundResponse({ description: 'No such series, or it has no logo.' })
  async logo(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const image = await this.series.readLogo(id);
    // One answer for "no such series" and "no logo", deliberately: a series that
    // exists but has no picture and one that does not exist look the same from
    // outside, so a 404 here says nothing about which it was.
    if (!image) throw new NotFoundException('This series has no logo.');

    // Set here rather than with `@Header`, because a decorator applies to the
    // 404 as well — and a 404 cached for a year would outlive the upload that
    // was supposed to fix it.
    response.setHeader('Cache-Control', IMMUTABLE);

    return new StreamableFile(image.bytes, {
      type: image.mimeType,
      length: image.bytes.length,
    });
  }
}
