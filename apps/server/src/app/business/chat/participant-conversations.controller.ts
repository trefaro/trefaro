import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CHAT_MODULE_KEY,
  MAX_MESSAGE_IMAGE_BYTES,
  MESSAGE_IMAGE_PART,
  brandingTypeSummary,
} from '@trefaro/shared-models';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import { CurrentParticipant, type AuthenticatedParticipant } from '../profiles';
import { ConversationsService } from './conversations.service';
import {
  ConversationPageDto,
  ConversationSummaryDto,
  ListConversationsDto,
  StartConversationDto,
} from './dto/conversation.dto';
import {
  ChatMessageDto,
  MessageHistoryDto,
  MessageWindowDto,
  SendMessageDto,
} from './dto/message.dto';
import { MessagesService } from './messages.service';
import {
  MESSAGE_UPLOAD_OPTIONS,
  type MessageMultipartFile,
} from './message-upload';

/**
 * Conversations and messages for a logged-in participant (FR 4.5 — E37, E40).
 *
 * One controller for the chat's two screens, which are one flow: the list of
 * conversations and the conversation itself. Four things hang on the path and
 * the decorators rather than on code in the methods:
 *
 * 1. **The session is the credential.** Everything below `participant/` is
 *    behind `ParticipantGuard` by virtue of its declared path (E33) — there is
 *    no anonymous chat, and the contact form for people without an account is
 *    a different endpoint with a different shape (AP 9, F11).
 * 2. **The module switch answers before the handler** (F53). The key is
 *    `chat`, not `profiles`: an organization may keep accounts and a
 *    participant directory and still not run messaging. Checking this one key
 *    is enough because the prerequisite is enforced where it is switched
 *    (E42) — `chat` cannot be on while `profiles` is off.
 * 3. **No throttle of its own.** The rule of `/api/participant/**`: behind a
 *    session the global limit applies, and the per-route budgets exist for
 *    routes a stranger can reach (E4).
 * 4. **Membership decides everything but the first request.** Opening a
 *    conversation asks whether the other person can be written to; reading and
 *    writing one ask only whether it is yours.
 */
@ApiTags('chat')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(CHAT_MODULE_KEY)
@Controller('participant/conversations')
export class ParticipantConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'My conversations, newest activity first (FR 4.5)',
    description:
      'Sorted by the last message, with the unread count derived from this ' +
      'reader’s own `last_read_at` and never stored (E38). A conversation ' +
      'nobody has written in yet sorts last.',
  })
  @ApiOkResponse({ type: ConversationPageDto })
  @ApiBadRequestResponse({ description: 'A page or a size that is not one.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  list(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Query() query: ListConversationsDto,
  ): Promise<ConversationPageDto> {
    return this.conversations.list(
      current.profile.id,
      query,
    ) as Promise<ConversationPageDto>;
  }

  @Post()
  // 200, not 201: this endpoint means "the conversation with this person", and
  // two people have one of those. Whether this request created it is not
  // something a client does anything different about — and a 201 that only
  // sometimes appeared would invite it to try.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Open the conversation with another participant (E37)',
    description:
      'Idempotent: the same two people always get the same conversation. ' +
      'Allowed only towards a profile the participant search shows — one ' +
      'switch decides being found and being written to (E37, F13).',
  })
  @ApiOkResponse({ type: ConversationSummaryDto })
  @ApiBadRequestResponse({ description: 'One’s own id, or not a uuid.' })
  @ApiForbiddenResponse({
    description:
      'This profile cannot be written to. Said the same way for an unknown ' +
      'id, an unconfirmed account and a profile that did not opt in — whoever ' +
      'can tell those apart can enumerate the accounts of an instance (F124).',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  start(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Body() body: StartConversationDto,
  ): Promise<ConversationSummaryDto> {
    return this.conversations.start(
      current.profile.id,
      body.profileId,
    ) as Promise<ConversationSummaryDto>;
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: 'One window of a conversation’s history (FR 4.5)',
    description:
      'Newest first, paged by a **cursor** rather than a page number: the ' +
      'list grows at the end while it is being read, so a page number would ' +
      'mean something different a second later. `hasMore` says whether ' +
      'anything older exists.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: MessageWindowDto })
  @ApiNotFoundResponse({
    description:
      'No conversation of that id is yours — said the same way for an ' +
      'unknown id and for somebody else’s conversation.',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  history(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MessageHistoryDto,
  ): Promise<MessageWindowDto> {
    return this.messages.history(
      current.profile.id,
      id,
      query,
    ) as Promise<MessageWindowDto>;
  }

  @Post(':id/messages')
  // Multer skips a request that is not multipart, so the same handler takes a
  // plain JSON body for a message without a picture.
  @UseInterceptors(FileInterceptor(MESSAGE_IMAGE_PART, MESSAGE_UPLOAD_OPTIONS))
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({
    summary: 'Say something in a conversation (FR 4.5, E40)',
    description:
      'Text, a picture, or both — never nothing. The text is the `body` ' +
      `field, the picture the \`${MESSAGE_IMAGE_PART}\` part; there is no ` +
      '`payload` part, because a message has no nested fields to wrap (F39). ' +
      `Accepted types are ${brandingTypeSummary()}, checked against the ` +
      'file’s own first bytes (F38).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        body: { type: 'string' },
        [MESSAGE_IMAGE_PART]: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: ChatMessageDto })
  @ApiBadRequestResponse({
    description: 'Neither text nor picture, or a file that is not an image.',
  })
  @ApiPayloadTooLargeResponse({
    description: `A picture above ${MAX_MESSAGE_IMAGE_BYTES} bytes.`,
  })
  @ApiNotFoundResponse({ description: 'No conversation of that id is yours.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  send(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendMessageDto,
    @UploadedFile() image: MessageMultipartFile | undefined,
  ): Promise<ChatMessageDto> {
    return this.messages.send(
      current.profile.id,
      id,
      body,
      image
        ? {
            mimeType: image.mimetype,
            bytes: image.buffer,
            fileName: image.originalname,
          }
        : null,
    ) as Promise<ChatMessageDto>;
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Mark this conversation as read up to now (E38)',
    description:
      'Moves this reader’s own `last_read_at`, which is the only state ' +
      'behind the unread count — there is nothing per message to write. Up ' +
      'to *now* rather than up to a message the client names: a client with ' +
      'the conversation open has seen what is in it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Read.' })
  @ApiNotFoundResponse({ description: 'No conversation of that id is yours.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  read(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.conversations.markRead(current.profile.id, id);
  }
}
