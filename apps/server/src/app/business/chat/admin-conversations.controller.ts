import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CHAT_MODULE_KEY } from '@trefaro/shared-models';
import type { Response } from 'express';
import { CoreModuleEnabledGuard, CoreModuleRoute } from '../config';
import { CurrentAdmin, type AuthenticatedAdmin } from '../login';
import {
  CreateGroupDto,
  GroupCandidateDto,
  GroupCandidatesDto,
  ListOrganizerConversationsDto,
  OrganizerConversationDetailDto,
  OrganizerConversationPageDto,
  OrganizerReplyDto,
} from './dto/organizer-conversation.dto';
import {
  MessageHistoryDto,
  MessageWindowDto,
  SendMessageDto,
} from './dto/message.dto';
import { OrganizerConversationsService } from './organizer-conversations.service';

/**
 * A year, and private — the same header the participants' picture route sets.
 *
 * Safe without a `?v=` because a message cannot be edited (E14): the bytes
 * behind this URL are the ones that were sent, forever.
 */
const IMMUTABLE = 'private, max-age=31536000, immutable';

/**
 * The organization's messages (FR 3.4, UC 14 — E39, F133).
 *
 * One controller for the mail-program-like overview FR 3.4 asks for: the list,
 * one conversation, its history, an answer, and the pictures inside it — plus
 * the two routes that assemble a group. Four things hang on the path and the
 * decorators rather than on code in the methods:
 *
 * 1. **The administrative session is the credential**, by virtue of the path:
 *    everything below `admin/` is behind the administrative guard (E16, E33).
 * 2. **Whose a conversation is, is its kind.** The organization has no
 *    membership row (F133), so no handler here asks about one — the service's
 *    port cannot read a `direct` conversation at all (F173). An organizer
 *    administers an instance; they do not read what two participants write to
 *    each other.
 * 3. **Reading and answering carry no module switch, assembling a group
 *    does** (F175). FR 3.4 is P1 and its two kinds share one screen, so the
 *    overview has to answer on an instance that runs no chat at all — the
 *    contact requests of AP 9 would otherwise arrive nowhere. Creating a
 *    *group* is FR 4.5, and a group whose members have no endpoints to read it
 *    with would be a conversation born dead, so those two routes ask for
 *    `chat`. The same distinction F171 made one level up.
 * 4. **No throttle of its own**, like every other administrative route: behind
 *    a session the global limit applies, and the per-route budgets exist for
 *    what a stranger can reach (E4).
 */
@ApiTags('chat')
@Controller('admin/conversations')
export class AdminConversationsController {
  constructor(private readonly conversations: OrganizerConversationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Every conversation the organization is part of (FR 3.4)',
    description:
      'Contact requests and groups, newest activity first, each with the ' +
      'last line as a preview. There is no unread count: the organization is ' +
      'not an account and has nowhere to keep one (F133) — what a row says ' +
      'instead is **who wrote last**, from which a client reads whether ' +
      'anybody has answered yet (`awaitsAnswer`). A shared mailbox is better ' +
      'served by that question than by "unread by me".',
  })
  @ApiOkResponse({ type: OrganizerConversationPageDto })
  @ApiBadRequestResponse({ description: 'A page or a size that is not one.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  list(
    @Query() query: ListOrganizerConversationsDto,
  ): Promise<OrganizerConversationPageDto> {
    return this.conversations.list(
      query,
    ) as Promise<OrganizerConversationPageDto>;
  }

  @Post()
  @UseGuards(CoreModuleEnabledGuard)
  @CoreModuleRoute(CHAT_MODULE_KEY)
  @ApiOperation({
    summary: 'Assemble a group around an event (FR 4.5, E39)',
    description:
      'Members are the event’s **confirmed** registrations that have a ' +
      'confirmed account, by the ids the candidate list handed out. Anybody ' +
      'else creates nothing: the insert derives the eligible people itself, ' +
      'and a request naming one who is not among them is a 400 with nothing ' +
      'written — a group short of the people it was assembled for would be ' +
      'worse than none. The group starts empty; the first line is written in ' +
      'the thread.',
  })
  @ApiCreatedResponse({ type: OrganizerConversationDetailDto })
  @ApiBadRequestResponse({
    description:
      'No subject, nobody in it, more than the maximum, or somebody without ' +
      'a confirmed registration for this event.',
  })
  @ApiNotFoundResponse({
    description: 'No event with that id — or the chat is switched off (F53).',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  createGroup(
    @Body() body: CreateGroupDto,
  ): Promise<OrganizerConversationDetailDto> {
    return this.conversations.createGroup(
      body,
    ) as Promise<OrganizerConversationDetailDto>;
  }

  // Before `:id`, or the word would be read as a conversation id — the same
  // order the organizer client's own routes use for `new`.
  @Get('candidates')
  @UseGuards(CoreModuleEnabledGuard)
  @CoreModuleRoute(CHAT_MODULE_KEY)
  @ApiOperation({
    summary: 'Who may be put into a group for this event (FR 4.5, E39)',
    description:
      'The event’s confirmed registrations that have a confirmed account, ' +
      'matched by address — the one link between a registration and a person ' +
      '(E31). Somebody who registered without ever creating an account is ' +
      'absent: a membership points at a profile, and they are reached by ' +
      'mail instead (FR 2.4). The address travels with the name because two ' +
      'people share a name, and the organizer already reads these addresses ' +
      'in the participant overview (E13).',
  })
  @ApiOkResponse({ type: [GroupCandidateDto] })
  @ApiNotFoundResponse({
    description: 'No event with that id — or the chat is switched off.',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  candidates(
    @Query() query: GroupCandidatesDto,
  ): Promise<readonly GroupCandidateDto[]> {
    return this.conversations.candidates(query.eventId) as Promise<
      readonly GroupCandidateDto[]
    >;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One conversation of the organization (FR 3.4)',
    description:
      'The row the overview draws, plus the names of the accounts in it — ' +
      'what a thread screen needs to say whose conversation it is showing.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrganizerConversationDetailDto })
  @ApiNotFoundResponse({
    description:
      'No conversation of that id belongs to the organization — said the ' +
      'same way for an unknown id and for two participants’ own conversation ' +
      '(F173).',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrganizerConversationDetailDto> {
    return this.conversations.get(
      id,
    ) as Promise<OrganizerConversationDetailDto>;
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: 'One window of a conversation’s history (FR 3.4)',
    description:
      'Newest first, paged by a cursor rather than a page number, for the ' +
      'reason the participants’ thread gives (F154): the list grows at the ' +
      'end while it is being read.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: MessageWindowDto })
  @ApiNotFoundResponse({
    description: 'No conversation of that id belongs to the organization.',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MessageHistoryDto,
  ): Promise<MessageWindowDto> {
    return this.conversations.history(id, query) as Promise<MessageWindowDto>;
  }

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Answer a conversation (FR 3.4, F11)',
    description:
      'Text only — no picture, unlike a participant’s message (E40): an ' +
      'answer to somebody without an account has to work as a **mail**, and ' +
      'an attachment there would be a second delivery mechanism FR 3.4 does ' +
      'not ask for. For a contact request the answer goes out by mail *and* ' +
      'stays in the history; `delivery` says what became of the mail, ' +
      'because the line is stored either way (F174).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: OrganizerReplyDto })
  @ApiBadRequestResponse({ description: 'An empty answer, or one too long.' })
  @ApiNotFoundResponse({
    description: 'No conversation of that id belongs to the organization.',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  reply(
    @CurrentAdmin() current: AuthenticatedAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendMessageDto,
  ): Promise<OrganizerReplyDto> {
    return this.conversations.reply(
      current.admin.id,
      id,
      body,
    ) as Promise<OrganizerReplyDto>;
  }

  @Get(':id/messages/:messageId/image')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  @ApiOperation({
    summary: 'The picture in a message of this conversation (E40)',
    description:
      'The organizer’s window on what a participant sent. Its own route ' +
      'rather than the `imageUrl` in the message: that one is served under ' +
      '`/api/media` and decides access by **membership**, which the ' +
      'organization does not have (F133, F156). Fetched with the ' +
      'administrative session and shown from a blob, the way a ' +
      'registration’s attachment already is — the upload volume is never ' +
      'served statically (E9).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'messageId', format: 'uuid' })
  @ApiOkResponse({
    description: 'The image.',
    content: { 'image/png': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiNotFoundResponse({
    description:
      'One sentence for four states: no such message, no picture on it, a ' +
      'picture in another conversation, and a conversation that is not the ' +
      'organization’s.',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  async image(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const image = await this.conversations.readImage(id, messageId);

    // Set here rather than with `@Header`, because a decorator applies to the
    // 404 as well — and a 404 cached for a year would outlive the row that was
    // about to make it a 200.
    response.setHeader('Cache-Control', IMMUTABLE);

    return new StreamableFile(image.bytes, {
      type: image.mimeType,
      length: image.bytes.length,
    });
  }
}
