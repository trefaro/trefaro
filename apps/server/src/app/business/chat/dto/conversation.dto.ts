import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CONVERSATION_TYPES,
  DEFAULT_CONVERSATION_PAGE_SIZE,
  MAX_CONVERSATION_PAGE_SIZE,
  type ConversationCounterpart,
  type ConversationPage,
  type ConversationQuery,
  type ConversationSummary,
  type ConversationType,
  type StartConversationRequest,
} from '@trefaro/shared-models';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

/**
 * The query of "my conversations".
 *
 * A window and nothing else: there is no filter, because a participant's list
 * of conversations is short and the one order it has is the one the overview
 * shows. No `locale` either, for the reason the participant search gives — a
 * name is a name, and a parameter that changed nothing would be a promise that
 * it does.
 */
export class ListConversationsDto implements ConversationQuery {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'One-based.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_CONVERSATION_PAGE_SIZE,
    default: DEFAULT_CONVERSATION_PAGE_SIZE,
    description: `Capped at ${MAX_CONVERSATION_PAGE_SIZE} by the service.`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

/**
 * What opening a conversation says (E37).
 *
 * One field, and it is an id rather than an address: whoever may be written to
 * is whoever the participant search shows, and a body that named a mailbox
 * would be a way to write to somebody who never made themselves findable.
 */
export class StartConversationDto implements StartConversationRequest {
  @ApiProperty({
    format: 'uuid',
    description:
      'The account to write to, by the id the participant search handed out.',
  })
  @IsUUID()
  profileId!: string;
}

/** The other side of a conversation, as a reader sees it. */
export class ConversationCounterpartDto implements ConversationCounterpart {
  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description:
      '`null` for the organizer and for somebody without an account — a ' +
      'client then shows the name and offers no link.',
  })
  profileId!: string | null;

  @ApiProperty({ example: 'Amina Okonkwo' })
  name!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '/api/media/profiles/6f1c…/avatar?v=1787790600000',
  })
  avatarUrl!: string | null;
}

export class ConversationSummaryDto implements ConversationSummary {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CONVERSATION_TYPES })
  type!: ConversationType;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'A group’s subject. `null` for a direct conversation, which is named ' +
      'by who it is with.',
  })
  topic!: string | null;

  @ApiProperty({
    type: [ConversationCounterpartDto],
    description: 'Everybody but the reader — exactly one for a direct chat.',
  })
  counterparts!: ConversationCounterpartDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: '`null` while nobody has written.',
  })
  lastMessageAt!: string | null;

  @ApiProperty({
    description:
      'Messages the reader has not seen, written by somebody else. Counted ' +
      'from their own `last_read_at` and never stored (E38).',
  })
  unread!: number;
}

export class ConversationPageDto implements ConversationPage {
  @ApiProperty({ type: [ConversationSummaryDto] })
  rows!: ConversationSummaryDto[];

  @ApiProperty({ description: 'What the pages divide, not this page’s size.' })
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
