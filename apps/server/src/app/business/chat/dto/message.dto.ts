import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DEFAULT_MESSAGE_PAGE_SIZE,
  MAX_MESSAGE_LENGTH,
  MAX_MESSAGE_PAGE_SIZE,
  MESSAGE_SENDER_TYPES,
  type ChatMessage,
  type MessageHistory,
  type MessageHistoryQuery,
  type MessageSenderType,
  type SendMessageInput,
} from '@trefaro/shared-models';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * What a history request may say.
 *
 * A cursor and a size, no page number: the list grows at the end while it is
 * being read, so a page number would mean something different a second later
 * — the argument is in `MessageHistory`.
 */
export class MessageHistoryDto implements MessageHistoryQuery {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Read strictly older than this message. Absent for the newest window. ' +
      'An id that is not in this conversation yields an empty window.',
  })
  @IsOptional()
  @IsUUID()
  before?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_MESSAGE_PAGE_SIZE,
    default: DEFAULT_MESSAGE_PAGE_SIZE,
    description: `Capped at ${MAX_MESSAGE_PAGE_SIZE} by the service.`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

/**
 * What sending a message says, beside the optional picture.
 *
 * One optional field, and "optional" is the whole subtlety: a message may be a
 * picture alone. That neither is present is refused by the service with a
 * sentence rather than here with a validation error, because "your message was
 * empty" is something a person reads (E40).
 *
 * The same class validates a JSON body and the fields of a
 * `multipart/form-data` request. Unlike a registration with a file (F39) there
 * is no `payload` part to unwrap: F39 needs one because a registration's
 * answers are a nested object and multipart cannot express one, and a message
 * is a single text field.
 */
export class SendMessageDto implements SendMessageInput {
  @ApiPropertyOptional({
    maxLength: MAX_MESSAGE_LENGTH,
    example: 'Great to meet you at the assembly!',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_MESSAGE_LENGTH)
  body?: string;
}

export class ChatMessageDto implements ChatMessage {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  conversationId!: string;

  @ApiProperty({ enum: MESSAGE_SENDER_TYPES })
  senderType!: MessageSenderType;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description:
      'The account or organizer behind it; `null` for somebody without an ' +
      'account. For a participant this is their profile id, which is what ' +
      'lets a client tell its own lines apart without comparing names.',
  })
  senderId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  body!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '/api/media/messages/6f1c…/attachment',
    description:
      'Addressed by the message, not by the file: only a member of the ' +
      'conversation may fetch it. No `?v=` — a message cannot be edited, so ' +
      'its picture never changes.',
  })
  imageUrl!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class MessageWindowDto implements MessageHistory {
  @ApiProperty({ type: [ChatMessageDto], description: 'Newest first.' })
  rows!: ChatMessageDto[];

  @ApiProperty({
    description:
      'Whether older messages exist behind the oldest row of this window. ' +
      'There is no total: nothing shows a message count, and counting every ' +
      'line of a long conversation on every scroll would be a query nobody ' +
      'reads.',
  })
  hasMore!: boolean;
}
