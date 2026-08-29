import {
  Controller,
  Get,
  Header,
  Headers,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  WEB_MANIFEST_MIME_TYPE,
  type WebManifest,
} from '@trefaro/shared-models';
import type { Response } from 'express';
import { WebManifestService } from './web-manifest.service';

/**
 * The PWA manifest of this instance (F20, E26).
 *
 * Under `config` rather than in a namespace of its own, because that is what it
 * is — one more thing a client fetches before it knows anything, beside
 * `/api/config` itself. It shares the prefix with `ConfigurationController` and
 * not the module, which is the whole point: this document needs the catalogue,
 * and the catalogue needs the configuration.
 *
 * Public, and it has to be: a browser fetches `<link rel="manifest">` without
 * credentials by default, and the participant client is installable by someone
 * who has never logged in.
 *
 * Revalidated rather than cached, exactly like the catalogue: an organization
 * that changes its name or its colour should see it on the next install, and
 * every input to this answer is one somebody can change from the design page.
 */
@ApiTags('configuration')
@Controller('config')
export class WebManifestController {
  constructor(private readonly manifests: WebManifestService) {}

  @Get('manifest.webmanifest')
  @Header('Content-Type', WEB_MANIFEST_MIME_TYPE)
  @Header('Cache-Control', 'no-cache, must-revalidate')
  @ApiOperation({
    summary: 'The web app manifest of this instance',
    description:
      "Built from the configuration: the organization's name, its primary " +
      'colour as `theme_color`, and either the uploaded app icon or the icons ' +
      'this image ships (E26). Requires no authentication.',
  })
  @ApiOkResponse({
    description: 'The manifest.',
    schema: {
      type: 'object',
      example: {
        name: 'Democracy International',
        theme_color: '#1f6f5c',
        icons: [{ src: '/icons/icon-512x512.png', sizes: '512x512' }],
      },
    },
  })
  async getManifest(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<WebManifest | undefined> {
    const { manifest, etag } = await this.manifests.resolve();
    response.setHeader('ETag', etag);

    if (matches(ifNoneMatch, etag)) {
      response.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }

    return manifest;
  }
}

/**
 * Whether the browser already holds this manifest.
 *
 * The same parsing as the catalogue endpoint's, and for the same reason: the
 * header may carry a list and a `W/` prefix.
 */
function matches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === '*') return true;

  return header
    .split(',')
    .map((candidate) => candidate.trim().replace(/^W\//, ''))
    .includes(etag);
}
