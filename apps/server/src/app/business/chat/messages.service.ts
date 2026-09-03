import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_MESSAGE_PAGE_SIZE,
  MAX_MESSAGE_LENGTH,
  MAX_MESSAGE_PAGE_SIZE,
  type ChatMessage,
  type MessageHistory,
  type MessageHistoryQuery,
  type SendMessageInput,
} from '@trefaro/shared-models';
import {
  ImageFileService,
  type ImageBytes,
} from '../common/image-file.service';
import { pageWindow } from '../common/page-window';
import { ChatRealtimeService } from './chat-realtime.service';
import { ConversationsService } from './conversations.service';
import { messageImageUrl } from './message-image-url';
import {
  MESSAGE_REPOSITORY,
  type AppendedMessage,
  type MessageRecord,
  type MessageRepository,
} from './ports/message.repository';

/**
 * A picture on its way into a message.
 *
 * `ImageUpload` plus the name it arrived under: the `attachment` row wants one
 * and an operator matching a file to a conversation is who has it. The claimed
 * type is a claim like everywhere else and is checked against the bytes (F38).
 */
export interface MessageImageUpload {
  readonly mimeType: string;
  readonly bytes: Buffer;
  readonly fileName: string;
}

/**
 * What every unanswerable request for a message's picture says.
 *
 * One sentence for three states — no such message, a message without a
 * picture, and a message in somebody else's conversation — because a member
 * of nothing must not be able to tell them apart. It is deliberately **not**
 * the conversation's wording either: a reader who could tell "that message has
 * no picture" from "that conversation is not yours" would have a way to ask
 * whether a message exists.
 */
const NO_SUCH_IMAGE = 'No picture of that message is yours to see.';

/**
 * The lines of a conversation: reading them, adding one, and its picture
 * (FR 4.5 — E38, E40).
 *
 * Everything here goes through the same gate first — {@link
 * ConversationsService.require} or its silent twin — and that is the whole
 * access rule of this service: **membership, not contactability.** Whether the
 * other person is still findable is asked once, when the conversation begins;
 * afterwards a conversation belongs to the people in it (E14, E37).
 *
 * Two things it owns beyond that:
 *
 * 1. **A message is text, a picture or both** (E40). Refused with a 400 before
 *    the `CHECK` has to, because "your message was empty" is a sentence and a
 *    constraint violation is not.
 * 2. **The bytes are written before the row and removed if the row fails.**
 *    There is no transaction across PostgreSQL and a filesystem, so this
 *    compensates in the direction that loses nothing readable: an unreferenced
 *    file costs disk, a message pointing at nothing costs somebody their
 *    picture. The same choice `AttachmentsService` makes for registration
 *    files, for the same reason.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly images: ImageFileService,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messages: MessageRepository,
    private readonly realtime: ChatRealtimeService,
  ) {}

  /**
   * One window of a conversation's history, newest first.
   *
   * One row more than asked for is read and thrown away again: that is what
   * turns "is there anything older" into an answer without a second query, and
   * it is why there is no total (see {@link MessageHistory}).
   */
  async history(
    viewerId: string,
    conversationId: string,
    query: MessageHistoryQuery,
  ): Promise<MessageHistory> {
    await this.conversations.require(viewerId, conversationId);

    // The window helper, for its size half only: a cursor list has no page
    // number, and the cap belongs in one place all the same (F138).
    const { pageSize } = pageWindow(
      query,
      DEFAULT_MESSAGE_PAGE_SIZE,
      MAX_MESSAGE_PAGE_SIZE,
    );

    const rows = await this.messages.history(
      conversationId,
      query.before ?? null,
      pageSize + 1,
    );

    return {
      rows: rows.slice(0, pageSize).map(toMessage),
      hasMore: rows.length > pageSize,
    };
  }

  /**
   * Adds a line to a conversation (E40).
   *
   * @throws NotFoundException — not a member, said the way an unknown id is.
   * @throws BadRequestException — neither text nor picture, or a text past
   * {@link MAX_MESSAGE_LENGTH}. The DTO refuses both first; this is what holds
   * when the service is called from anywhere else, and the real-time package
   * will be somewhere else.
   */
  async send(
    viewerId: string,
    conversationId: string,
    input: SendMessageInput,
    image: MessageImageUpload | null,
  ): Promise<ChatMessage> {
    await this.conversations.require(viewerId, conversationId);

    const body = (input.body ?? '').trim();
    if (body.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `A message may be up to ${MAX_MESSAGE_LENGTH} characters.`,
      );
    }
    if (body.length === 0 && !image) {
      throw new BadRequestException(
        'A message needs text, a picture, or both. An empty one is not a ' +
          'message.',
      );
    }

    // Checked and written before the row that will name it, so a refused
    // picture leaves the volume as it was (F38, E19).
    const path = image
      ? await this.images.store('messages', {
          mimeType: image.mimeType,
          bytes: image.bytes,
        })
      : null;

    let appended: AppendedMessage;
    try {
      appended = await this.messages.append({
        conversationId,
        senderType: 'user',
        senderId: viewerId,
        // Never an empty string: the column says `NULL` or something, and a
        // message that is only a picture has no body.
        body: body.length > 0 ? body : null,
        image:
          path && image
            ? {
                path,
                fileName: image.fileName,
                mimeType: image.mimeType,
                sizeBytes: image.bytes.length,
              }
            : null,
      });
    } catch (error: unknown) {
      // Compensation, not a rollback: what this request wrote goes away again.
      await this.images.discard([path]);
      throw error;
    }

    // Stored first, delivered second, and outside the compensation on purpose:
    // the picture is discarded when the **row** failed, and a delivery cannot
    // undo a message that is already written (E41). Nothing is awaited — the
    // members were read in the same transaction as the line.
    const message = toMessage(appended.record);
    this.realtime.publishMessage(message, appended.members);
    return message;
  }

  /**
   * The bytes of a message's picture, for a member of its conversation.
   *
   * The one media route of this application that checks a permission (E40),
   * and the reason is what the bytes are: a logo is a mark and an avatar is
   * handed out with an id its reader may already see (F115, F124), whereas
   * this is content inside a conversation. Membership is asked here rather
   * than in the controller because the three ways this can fail have to end up
   * as one sentence.
   */
  async readImage(viewerId: string, messageId: string): Promise<ImageBytes> {
    const image = await this.messages.findImage(messageId);
    if (!image) throw new NotFoundException(NO_SUCH_IMAGE);

    const membership = await this.conversations.membershipOf(
      viewerId,
      image.conversationId,
    );
    if (!membership) throw new NotFoundException(NO_SUCH_IMAGE);

    // Reads only from its own area and decides the type from the first bytes,
    // like every other served image. `null` means the volume no longer holds
    // what the row names — an operator's problem, and from outside the same
    // 404 as everything else.
    const bytes = await this.images.read('messages', image.path);
    if (!bytes) throw new NotFoundException(NO_SUCH_IMAGE);
    return bytes;
  }
}

function toMessage(record: MessageRecord): ChatMessage {
  return {
    id: record.id,
    conversationId: record.conversationId,
    senderType: record.senderType,
    senderId: record.senderId,
    body: record.body,
    // Built from the message id, because that is what membership is decided
    // from — the stored path never leaves the server.
    imageUrl: messageImageUrl(record.id, record.hasImage),
    createdAt: record.createdAt.toISOString(),
  };
}
