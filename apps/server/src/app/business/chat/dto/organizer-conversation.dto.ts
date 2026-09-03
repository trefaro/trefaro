import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DEFAULT_ORGANIZER_CONVERSATION_PAGE_SIZE,
  MAX_GROUP_MEMBERS,
  MAX_GROUP_TOPIC_LENGTH,
  MAX_ORGANIZER_CONVERSATION_PAGE_SIZE,
  MESSAGE_PREVIEW_LENGTH,
  MESSAGE_SENDER_TYPES,
  ORGANIZER_CONVERSATION_TYPES,
  REPLY_DELIVERIES,
  type ConversationCounterpart,
  type ConversationEventRef,
  type ConversationGuest,
  type ConversationPreview,
  type GroupCandidate,
  type MessageSenderType,
  type NewGroupRequest,
  type OrganizerConversationDetail,
  type OrganizerConversationPage,
  type OrganizerConversationQuery,
  type OrganizerConversationSummary,
  type OrganizerConversationType,
  type OrganizerReply,
  type ReplyDelivery,
} from '@trefaro/shared-models';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { ChatMessageDto } from './message.dto';

/** The query of the organization's overview — a window and nothing else. */
export class ListOrganizerConversationsDto implements OrganizerConversationQuery {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'One-based.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_ORGANIZER_CONVERSATION_PAGE_SIZE,
    default: DEFAULT_ORGANIZER_CONVERSATION_PAGE_SIZE,
    description: `Capped at ${MAX_ORGANIZER_CONVERSATION_PAGE_SIZE} by the service.`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

/** Which event's confirmed registrations a group may be assembled from. */
export class GroupCandidatesDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  eventId!: string;
}

class ConversationEventDto implements ConversationEventRef {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    description: 'Both slugs, so the overview can link the page.',
  })
  slug!: string;

  @ApiProperty()
  seriesSlug!: string;
}

class ConversationGuestDto implements ConversationGuest {
  @ApiProperty({ nullable: true, type: String })
  name!: string | null;

  @ApiProperty({
    description:
      'Where the answer goes (F11). Unverified — nothing authenticates the ' +
      'address somebody types into a public form.',
  })
  email!: string;
}

class ConversationPreviewDto implements ConversationPreview {
  @ApiProperty({
    enum: MESSAGE_SENDER_TYPES,
    description:
      'Who wrote the last line. `admin` means the organization has answered ' +
      '— which is what replaces an unread count here (F133).',
  })
  senderType!: MessageSenderType;

  @ApiProperty({
    nullable: true,
    type: String,
    description: `Cut to ${MESSAGE_PREVIEW_LENGTH} characters by the server. \`null\` for a message that is only a picture.`,
  })
  text!: string | null;

  @ApiProperty()
  hasImage!: boolean;
}

class ConversationMemberDto implements ConversationCounterpart {
  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  profileId!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;
}

export class OrganizerConversationDto implements OrganizerConversationSummary {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    enum: ORGANIZER_CONVERSATION_TYPES,
    description:
      'Only these two. A `direct` conversation between participants cannot ' +
      'be read here at all — the statements behind this endpoint are scoped ' +
      'to the two kinds the organization is part of (F173).',
  })
  type!: OrganizerConversationType;

  @ApiProperty({ nullable: true, type: String })
  topic!: string | null;

  @ApiProperty({ nullable: true, type: ConversationEventDto })
  event!: ConversationEventDto | null;

  @ApiProperty({ nullable: true, type: ConversationGuestDto })
  guest!: ConversationGuestDto | null;

  @ApiProperty({ description: 'Accounts in it — `0` for a contact request.' })
  memberCount!: number;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastMessageAt!: string | null;

  @ApiProperty({ nullable: true, type: ConversationPreviewDto })
  preview!: ConversationPreviewDto | null;
}

export class OrganizerConversationDetailDto
  extends OrganizerConversationDto
  implements OrganizerConversationDetail
{
  @ApiProperty({
    type: [ConversationMemberDto],
    description: 'Empty for a contact request — a guest has no account.',
  })
  members!: ConversationMemberDto[];
}

export class OrganizerConversationPageDto implements OrganizerConversationPage {
  @ApiProperty({ type: [OrganizerConversationDto] })
  rows!: OrganizerConversationDto[];

  @ApiProperty({ description: 'The whole list, not this page’s length.' })
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class GroupCandidateDto implements GroupCandidate {
  @ApiProperty({ format: 'uuid' })
  profileId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;
}

/**
 * What assembling a group says (E39).
 *
 * The ids are bounded here and validated **again** by the insert, which is
 * where the rule actually lives: only a confirmed registrant of this event
 * with an account can become a member, whatever a caller sends.
 */
export class CreateGroupDto implements NewGroupRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  eventId!: string;

  @ApiProperty({ maxLength: MAX_GROUP_TOPIC_LENGTH })
  @IsString()
  @Length(1, MAX_GROUP_TOPIC_LENGTH)
  topic!: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    maxItems: MAX_GROUP_MEMBERS,
    description: 'By the ids the candidate list handed out.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_GROUP_MEMBERS)
  @IsUUID('4', { each: true })
  profileIds!: string[];
}

export class OrganizerReplyDto implements OrganizerReply {
  @ApiProperty({ type: ChatMessageDto })
  message!: ChatMessageDto;

  @ApiProperty({
    enum: REPLY_DELIVERIES,
    description:
      '`none` — nothing to send, the members read it in the app. `sent` — ' +
      'the answer went to the person who asked (F11). `failed` — it did not, ' +
      'and the line is stored all the same (F174).',
  })
  delivery!: ReplyDelivery;
}
