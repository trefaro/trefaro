import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CurrentPluginOrganizer,
  PluginController,
  PluginEnabledGuard,
  type PluginOrganizer,
} from '../../../app/business/plugin-api';
import { ForumService } from '../business/forum.service';
import { FORUM_PLUGIN_KEY } from '../forum.plugin-key';
import {
  ForumModerationPageDto,
  ForumModerationQueryDto,
  ModeratedForumPostDto,
} from './forum.dto';

/**
 * Moderating the forum (FR 4.6, UC 15).
 *
 * Behind the administrative session by virtue of its path (E16, E57): a plug-in
 * gets its access level from the address it declares and has no way to
 * authenticate anything itself.
 *
 * **A decision is a route, not a field** (E51). `POST …/approval` and
 * `POST …/rejection` rather than a `PATCH` carrying a status: the two things an
 * organizer does are two things, they are the whole of the moderation effort
 * the survey asked to keep minimal, and neither is a state machine with a
 * comment thread. A `PATCH` would also have been a shape in which somebody
 * eventually sets `pending` back — which is not a decision.
 *
 * **Decided per post, never per thread** (F195). A thread has no status; it
 * becomes visible with its first approved post, and each later post is its own
 * decision. The row an organizer decides on therefore carries its thread, so
 * that the section on the dashboard can show each post in the context it was
 * written in.
 *
 * Both decisions answer 200 with the row as it now is, rather than 204: the
 * organizer's list is the screen this is called from, and the answer is what it
 * redraws. The count for that section (`…/summary`) is AP 5's, and is not
 * built while nothing reads it (E21).
 */
@ApiTags('plugin: discussion forum')
@ApiNotFoundResponse({
  description: 'The discussion forum plug-in is not enabled on this instance.',
})
@PluginController(FORUM_PLUGIN_KEY)
@UseGuards(PluginEnabledGuard)
@Controller('admin/plugins/forum')
export class AdminForumController {
  constructor(private readonly forum: ForumService) {}

  @Get('events/:eventId/posts')
  @ApiOperation({
    summary: 'The moderation list of one event (FR 4.6)',
    description:
      'Every post of this event’s forum, optionally narrowed to one status — ' +
      'the queue is `?status=pending`, and the whole history without it. Each ' +
      'row carries the thread it is in. Filtered, sorted and paginated in ' +
      'SQL, newest first with the id as the last criterion; the event is ' +
      'decided by the thread, so another event’s posts cannot appear here.',
  })
  @ApiOkResponse({ type: ForumModerationPageDto })
  @ApiBadRequestResponse({
    description: 'A status that is not one, or a page that is not a page.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  list(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: ForumModerationQueryDto,
  ): Promise<ForumModerationPageDto> {
    return this.forum.moderationList(
      eventId,
      query,
    ) as Promise<ForumModerationPageDto>;
  }

  @Post('posts/:postId/approval')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a post (FR 4.6)',
    description:
      'Publishes it to everybody reading this thread — and publishes the ' +
      'thread itself, if this was its first approved post (F195). Approving an ' +
      'already decided post is a correction and moves the instant.',
  })
  @ApiOkResponse({ type: ModeratedForumPostDto })
  @ApiNotFoundResponse({ description: 'No post with that id.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  approve(
    @CurrentPluginOrganizer() organizer: PluginOrganizer,
    @Param('postId', ParseUUIDPipe) postId: string,
  ): Promise<ModeratedForumPostDto> {
    return this.forum.approve(
      postId,
      organizer.id,
    ) as Promise<ModeratedForumPostDto>;
  }

  @Post('posts/:postId/rejection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a post (FR 4.6)',
    description:
      'The row stays (E14) and keeps showing its status to the person who ' +
      'wrote it — deleting it would make a refusal indistinguishable from a ' +
      'post that never arrived. Two parties see a rejected post: its author ' +
      'and the organization.',
  })
  @ApiOkResponse({ type: ModeratedForumPostDto })
  @ApiNotFoundResponse({ description: 'No post with that id.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  reject(
    @CurrentPluginOrganizer() organizer: PluginOrganizer,
    @Param('postId', ParseUUIDPipe) postId: string,
  ): Promise<ModeratedForumPostDto> {
    return this.forum.reject(
      postId,
      organizer.id,
    ) as Promise<ModeratedForumPostDto>;
  }
}
