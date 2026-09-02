import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PROFILES_MODULE_KEY } from '@trefaro/shared-models';
import type { Response } from 'express';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import { ProfilesService } from './profiles.service';

/**
 * A year. Safe only because the URL carries `?v=<updated_at>`, so a changed
 * picture is a changed URL — the argument is in `avatar-url.ts`.
 */
const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * The profile picture of one participant (FR 4.3 — F124).
 *
 * The fourth route to stored bytes, and the first one whose bytes are a picture
 * of a person rather than a brand. It is public all the same, and that deserves
 * its argument rather than a reference to F115 — two of the three reasons given
 * there do not carry here: an avatar *is* participant data, and there is no
 * organizer preview that a stricter rule would break.
 *
 * What decides it is the third reason plus E34. The address needs the account's
 * uuid, which is derivable from nothing public and is handed out only with a
 * profile the asker may already see. And the alternative is worse in a way this
 * architecture has already ruled out: a session-protected avatar would have to
 * be readable by a participant *and* by an organizer, so its guard would have to
 * accept either cookie — exactly the guard E34 exists to prevent — or there
 * would have to be two routes to the same bytes, which is what E19 exists to
 * prevent.
 *
 * It follows that the participant search must never hand out the id of a profile
 * it would not show (AP 5). The 404 here says only "there is no picture", never
 * whether the account exists.
 *
 * The two headers are the pair every media route of this application carries:
 * the type of these bytes is decided by their own first bytes (F38), which a
 * browser that sniffs the answer would undo; and if somebody navigates straight
 * to the URL, nothing that comes back may load or run anything.
 */
@ApiTags('profiles')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(PROFILES_MODULE_KEY)
@Controller('media/profiles')
export class ProfileAvatarMediaController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get(':id/avatar')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  @ApiOperation({
    summary: 'The profile picture of a participant',
    description:
      'Answers 404 while the profile has no picture, and for an id that does ' +
      'not exist — from outside the two look the same. The URL to use is the ' +
      '`avatarUrl` of the profile itself, with a `?v=` that changes whenever ' +
      'the picture does; this answer is cached for a year.',
  })
  @ApiOkResponse({
    description: 'The image.',
    content: { 'image/png': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiNotFoundResponse({
    description: 'No such account, or it has no picture.',
  })
  async avatar(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const image = await this.profiles.readAvatar(id);
    if (!image) throw new NotFoundException('This profile has no picture.');

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
