import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CurrentPluginParticipant,
  PluginController,
  PluginEnabledGuard,
  type PluginParticipant,
} from '../../../app/business/plugin-api';
import { ForumService } from '../business/forum.service';
import { FORUM_PLUGIN_KEY } from '../forum.plugin-key';
import {
  ForumPageQueryDto,
  ForumPostDto,
  ForumPostPageDto,
  ForumThreadPageDto,
  NewForumPostDto,
  NewForumThreadDto,
  OpenedForumThreadDto,
} from './forum.dto';

/**
 * What a participant does in the forum (FR 4.6).
 *
 * Under `participant/`, not `user/` (E58): a post carries the name of a person,
 * and this application is built for organizations whose participants are
 * activists — so reading and writing both need a session. The element on the
 * event page is still mounted for everybody and shows an invitation to log in;
 * a tile that appeared only to those already logged in would be a feature
 * nobody hears about.
 *
 * Three things hang on the path and the decorators rather than on code below:
 *
 * 1. **The session is the credential.** Everything under `participant/` is
 *    behind the host's participant guard by virtue of its declared path (E33),
 *    and a plug-in has no way to declare or withdraw one (E57).
 * 2. **The plug-in switch answers before the handler.** While the organization
 *    has the plug-in off, every line here is a 404 and `/api/config` does not
 *    mention it — a disabled plug-in looks absent rather than forbidden.
 * 3. **No throttle of its own.** The rule of `/api/participant/**`: behind a
 *    session the global limit applies, and the per-route budgets exist for
 *    routes a stranger can reach (E4).
 *
 * The lists are paginated by page number, not by cursor: a forum is not a
 * conversation that grows at its end while one reads it (F154 belongs to the
 * chat and stays there).
 */
@ApiTags('plugin: discussion forum')
@ApiNotFoundResponse({
  description: 'The discussion forum plug-in is not enabled on this instance.',
})
@PluginController(FORUM_PLUGIN_KEY)
@UseGuards(PluginEnabledGuard)
@Controller('participant/plugins/forum')
export class ParticipantForumController {
  constructor(private readonly forum: ForumService) {}

  @Get('events/:eventId/threads')
  @ApiOperation({
    summary: 'The threads of this event a participant may see (FR 4.6)',
    description:
      'Every thread with a published post, plus every thread the reader has ' +
      'written in whatever the status (E51, F195) — latest published activity ' +
      'first, the id as the last criterion. A stranger’s thread nobody has ' +
      'published anything in cannot be asked for. Filtered, sorted and ' +
      'paginated in SQL.',
  })
  @ApiOkResponse({ type: ForumThreadPageDto })
  @ApiBadRequestResponse({ description: 'A page or a size that is not one.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  listThreads(
    @CurrentPluginParticipant() me: PluginParticipant,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: ForumPageQueryDto,
  ): Promise<ForumThreadPageDto> {
    return this.forum.listThreads(
      eventId,
      me.id,
      query,
    ) as Promise<ForumThreadPageDto>;
  }

  @Post('events/:eventId/threads')
  @ApiOperation({
    summary: 'Open a thread with its first post (FR 4.6)',
    description:
      'The post is created as `pending`, and the thread is therefore visible ' +
      'to nobody but its author and the organization until somebody decides ' +
      '(E51, F195). Both come back, because the screen that follows shows both.',
  })
  @ApiCreatedResponse({ type: OpenedForumThreadDto })
  @ApiBadRequestResponse({
    description:
      'A title or a body that is missing, too long, or only whitespace.',
  })
  @ApiNotFoundResponse({
    description:
      'No such event — the database says so (F21), and an unknown event is ' +
      'answered as absent rather than as a failed constraint.',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  openThread(
    @CurrentPluginParticipant() me: PluginParticipant,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: NewForumThreadDto,
  ): Promise<OpenedForumThreadDto> {
    return this.forum.openThread(
      eventId,
      me.id,
      body,
    ) as Promise<OpenedForumThreadDto>;
  }

  @Get('threads/:threadId/posts')
  @ApiOperation({
    summary: "One thread: its approved posts plus one's own (FR 4.6)",
    description:
      'Oldest first — a conversation reads top-down — with the thread itself ' +
      'in the answer, so a deep link needs no second request. A pending or ' +
      'rejected post is in the list only for the person who wrote it (E51).',
  })
  @ApiOkResponse({ type: ForumPostPageDto })
  @ApiBadRequestResponse({ description: 'A page or a size that is not one.' })
  @ApiNotFoundResponse({
    description:
      'No such thread — or none this reader may see; the two are one answer, ' +
      'so a guessed id learns nothing.',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  listPosts(
    @CurrentPluginParticipant() me: PluginParticipant,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Query() query: ForumPageQueryDto,
  ): Promise<ForumPostPageDto> {
    return this.forum.listPosts(
      threadId,
      me.id,
      query,
    ) as Promise<ForumPostPageDto>;
  }

  @Post('threads/:threadId/posts')
  @ApiOperation({
    summary: 'Reply to a thread (FR 4.6)',
    description:
      'Created as `pending`; visible to its author and the organization until ' +
      'somebody decides. One cannot reply into a thread one cannot read: the ' +
      'answer for such a thread is the 404 an unknown id gets.',
  })
  @ApiCreatedResponse({ type: ForumPostDto })
  @ApiBadRequestResponse({
    description: 'A body that is missing, too long, or only whitespace.',
  })
  @ApiNotFoundResponse({
    description: 'No such thread, or none this author may see.',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  reply(
    @CurrentPluginParticipant() me: PluginParticipant,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Body() body: NewForumPostDto,
  ): Promise<ForumPostDto> {
    return this.forum.reply(threadId, me.id, body) as Promise<ForumPostDto>;
  }
}
