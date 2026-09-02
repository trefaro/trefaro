import {
  Controller,
  Get,
  Header,
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
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CHAT_MODULE_KEY } from '@trefaro/shared-models';
import type { Response } from 'express';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import {
  CurrentParticipant,
  RequiresParticipant,
  type AuthenticatedParticipant,
} from '../profiles';
import { MessagesService } from './messages.service';

/**
 * A year, and private.
 *
 * Safe without a `?v=` — unlike every other media route — because a message
 * cannot be edited (E14): the picture behind this URL is the one it was sent
 * with, forever. `private` because the bytes are content inside a conversation
 * and no shared cache has any business holding them.
 */
const IMMUTABLE = 'private, max-age=31536000, immutable';

/**
 * The picture in a message (FR 4.5 — E40).
 *
 * The fifth route to stored bytes and the **only** one that checks a
 * permission, which is worth its own argument rather than a reference to F115
 * or F124. Those two are about a logo and an avatar: a logo is a mark, and an
 * avatar is handed out together with an id its reader may already see. Neither
 * carries here — this is content somebody sent to a specific set of people,
 * and the acceptance criterion of this package says in so many words that a
 * non-member gets neither the history **nor** the picture.
 *
 * Two consequences follow, and both are visible in this file:
 *
 * - **It needs a session although its path does not say so.** The prefix for
 *   stored bytes is `/api/media` (E19, F113) and moving one route out of it
 *   would mean two places to look for the same kind of thing, so the session
 *   is demanded by {@link RequiresParticipant} — a decorator that can only ever
 *   add a requirement, which is why it does not undo F69's argument.
 * - **The organizer does not read the bytes here.** A guard accepting either
 *   cookie is what E34 forbids, so the organizer's window on a conversation's
 *   picture is a route under their own prefix, and it arrives with the
 *   overview that needs it (AP 10). What it is *not* is
 *   `GET /api/admin/attachments/:id` — since this package that route answers
 *   only for the files a registration collected.
 *
 * The two headers are the pair every media route of this application carries:
 * the type of these bytes is decided by their own first bytes (F38), which a
 * browser that sniffs the answer would undo; and if somebody navigates
 * straight to the URL, nothing that comes back may load or run anything.
 */
@ApiTags('chat')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(CHAT_MODULE_KEY)
@RequiresParticipant()
@Controller('media/messages')
export class MessageImageMediaController {
  constructor(private readonly messages: MessagesService) {}

  @Get(':id/attachment')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  @ApiOperation({
    summary: 'The picture in a message, for a member of its conversation',
    description:
      'Answers 404 for an unknown message, for a message without a picture ' +
      'and for a message in somebody else’s conversation — one sentence for ' +
      'all three, because telling them apart would be a way to ask whether a ' +
      'message exists. The URL to use is the `imageUrl` of the message ' +
      'itself; the answer is cached for a year, privately.',
  })
  @ApiOkResponse({
    description: 'The image.',
    content: { 'image/png': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiNotFoundResponse({ description: 'No such picture, or not yours.' })
  async image(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const image = await this.messages.readImage(current.profile.id, id);

    // Set here rather than with `@Header`, because a decorator applies to the
    // 404 as well — and a 404 cached for a year would outlive the membership
    // that was about to make it a 200.
    response.setHeader('Cache-Control', IMMUTABLE);

    return new StreamableFile(image.bytes, {
      type: image.mimeType,
      length: image.bytes.length,
    });
  }
}
