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
import { EventsService } from './events.service';

/**
 * A year. Safe only because the URL carries `?v=<updated_at>`, so a changed
 * image is a changed URL — the argument is in `logo-files/logo-url.ts`.
 */
const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * The public logo of one event (FR 3.1, E19).
 *
 * The series route's twin — see `SeriesLogoMediaController` for why a public
 * route to stored bytes can exist next to E9 at all: it takes no *path* from its
 * caller, so a registration attachment cannot be named here.
 *
 * Outside `/api/user` and `/api/admin` on purpose: an event landing page is
 * public, and it shows this image before anyone has logged in.
 *
 * The two headers are the pair the branding routes and the attachment download
 * carry, for the same reasons: the type of these bytes is decided by their own
 * first bytes (F38), which a browser that sniffs the answer would undo; and if
 * somebody navigates straight to the URL, nothing that comes back may load or
 * run anything.
 */
@ApiTags('events')
@Controller('media/events')
export class EventLogoMediaController {
  constructor(private readonly events: EventsService) {}

  @Get(':id/logo')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  @ApiOperation({
    summary: 'The logo of an event',
    description:
      'Public, so the event landing page can show it. Answers 404 while the ' +
      'event has no logo, and for an id that does not exist. The URL to use is ' +
      'the `logoUrl` of the event itself, with a `?v=` that changes whenever ' +
      'the row does — this answer is cached for a year.',
  })
  @ApiOkResponse({
    description: 'The image.',
    content: { 'image/png': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiNotFoundResponse({ description: 'No such event, or it has no logo.' })
  async logo(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const image = await this.events.readLogo(id);
    // One answer for "no such event" and "no logo", for the reason the series
    // route gives: from outside, the two look the same.
    if (!image) throw new NotFoundException('This event has no logo.');

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
