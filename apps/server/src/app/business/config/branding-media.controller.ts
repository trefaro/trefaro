import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { BrandingImageKind } from '@trefaro/shared-models';
import type { Response } from 'express';
import { BrandingService } from './branding.service';

/**
 * A year. Safe only because the URL carries `?v=<updated_at>`, so a changed
 * image is a changed URL — the argument is in `branding-url.ts`.
 */
const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * The two public branding images (FR 1.4, E19).
 *
 * The **only** public route to bytes stored by this instance, and the reason it
 * can exist next to E9 ("the upload volume is never served statically") is that
 * it takes nothing from its caller. There is no path parameter, no id and no
 * file name: `logo` and `app-icon` are the two things that exist, and what they
 * resolve to is whatever `app_config` points at. A registration attachment
 * cannot be named here, because nothing can be named here.
 *
 * Deliberately outside `/api/user` and `/api/admin`: the participant start page
 * and every event landing page are public, and both show the logo before anyone
 * has logged in. A mail that carries the logo — AP 10 rewrites the templates —
 * needs it from the outside for the same reason.
 *
 * The two headers on each handler are the same pair the attachment download
 * carries, for the same reasons: the type of these bytes is decided by their own
 * first bytes (F38), which a browser that sniffs the answer would undo; and if
 * somebody navigates straight to the URL, nothing in what comes back may load or
 * run anything. They are repeated rather than put on {@link serve}, because a
 * decorator on a method Nest never registers as a route does nothing, silently.
 *
 * No `CoreModuleEnabledGuard`: an instance whose logo could be switched off
 * would be a whitelabel application with its label switched off.
 */
@ApiTags('configuration')
@Controller('media/branding')
export class BrandingMediaController {
  constructor(private readonly branding: BrandingService) {}

  @Get('logo')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  @ApiOperation({
    summary: 'The organization logo',
    description:
      'Public, so the landing pages and the mails can show it. Answers 404 ' +
      'while no logo is uploaded. The URL to use is in `/api/config`, with a ' +
      '`?v=` that changes whenever the configuration does — this answer is ' +
      'cached for a year.',
  })
  @ApiOkResponse({
    description: 'The image.',
    content: { 'image/png': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiNotFoundResponse({ description: 'No logo is uploaded.' })
  logo(
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.serve('logo', response);
  }

  @Get('app-icon')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  @ApiOperation({
    summary: 'The app icon for a home screen',
    description:
      'Answers 404 while none is uploaded, in which case the icons shipped ' +
      'with the client apply (E26).',
  })
  @ApiOkResponse({
    description: 'The image.',
    content: { 'image/png': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiNotFoundResponse({ description: 'No app icon is uploaded.' })
  appIcon(
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.serve('app-icon', response);
  }

  private async serve(
    kind: BrandingImageKind,
    response: Response,
  ): Promise<StreamableFile> {
    const image = await this.branding.read(kind);
    if (!image) throw new NotFoundException(`No ${kind} is uploaded.`);

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
