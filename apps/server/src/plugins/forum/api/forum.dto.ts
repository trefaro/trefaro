import { ApiProperty } from '@nestjs/swagger';
import {
  FORUM_POST_STATUSES,
  MAX_FORUM_PAGE_SIZE,
  MAX_FORUM_POST_LENGTH,
  MAX_FORUM_THREAD_TITLE_LENGTH,
  type ForumAuthor,
  type ForumModerationPage,
  type ForumModerationQuery,
  type ForumPageQuery,
  type ForumPost,
  type ForumPostPage,
  type ForumPostStatus,
  type ForumThread,
  type ForumThreadPage,
  type ForumThreadReference,
  type ModeratedForumPost,
  type NewForumPost,
  type NewForumThread,
  type OpenedForumThread,
} from '@trefaro/shared-models';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * The payloads of the discussion forum plug-in.
 *
 * Each one implements the interface of the same name in `shared-models`: a
 * client that loads this plug-in's bundle shares the models with it, so a change
 * to the shape breaks a build rather than a request.
 */
export class ForumAuthorDto implements ForumAuthor {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    example: 'Amina Okonkwo',
    description:
      'First and last name in one string. Never an address — a plug-in is not ' +
      'a way around F55.',
  })
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;
}

export class ForumThreadDto implements ForumThread {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({ example: 'Where do we meet on Saturday morning?' })
  title!: string;

  @ApiProperty({
    nullable: true,
    type: ForumAuthorDto,
    description:
      'Who opened the thread; `null` when that account is gone — not an ' +
      'anonymous thread, and deliberately not a placeholder name.',
  })
  author!: ForumAuthor | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({
    format: 'date-time',
    description:
      'The latest **published** post, or the thread’s creation while there is ' +
      'none (F195). The list is sorted by it, so a post nobody may read yet ' +
      'moves nothing.',
  })
  lastPostAt!: string;
}

export class ForumPostDto implements ForumPost {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  threadId!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({
    enum: FORUM_POST_STATUSES,
    description:
      'Three states and no process (E51). A rejected post keeps its row and ' +
      'stays visible to the person who wrote it, and to nobody else but the ' +
      'organization.',
  })
  status!: ForumPostStatus;

  @ApiProperty({ nullable: true, type: ForumAuthorDto })
  author!: ForumAuthor | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: '`null` while it is pending; the two cannot drift apart.',
  })
  decidedAt!: string | null;
}

export class ForumThreadReferenceDto implements ForumThreadReference {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;
}

/** A post as the organizer's list shows it: with the thread it is in. */
export class ModeratedForumPostDto
  extends ForumPostDto
  implements ModeratedForumPost
{
  @ApiProperty({
    type: ForumThreadReferenceDto,
    description:
      'The thread this post belongs to — a post out of context is a sentence ' +
      'without its question.',
  })
  thread!: ForumThreadReference;
}

export class OpenedForumThreadDto implements OpenedForumThread {
  @ApiProperty({ type: ForumThreadDto })
  thread!: ForumThreadDto;

  @ApiProperty({
    type: ForumPostDto,
    description: 'The first post, as created — pending, like every post.',
  })
  post!: ForumPostDto;
}

export class ForumThreadPageDto implements ForumThreadPage {
  @ApiProperty({ type: [ForumThreadDto] })
  rows!: readonly ForumThreadDto[];

  @ApiProperty({
    description: 'What the pages divide, not this page’s length.',
  })
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class ForumPostPageDto implements ForumPostPage {
  @ApiProperty({
    type: ForumThreadDto,
    description:
      'The thread these posts are in — the thread view is one screen, and a ' +
      'screen is one request (F49).',
  })
  thread!: ForumThreadDto;

  @ApiProperty({ type: [ForumPostDto] })
  rows!: readonly ForumPostDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class ForumModerationPageDto implements ForumModerationPage {
  @ApiProperty({ type: [ModeratedForumPostDto] })
  rows!: readonly ModeratedForumPostDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

/** What a participant sends to open a thread (FR 4.6). */
export class NewForumThreadDto implements NewForumThread {
  @ApiProperty({
    maxLength: MAX_FORUM_THREAD_TITLE_LENGTH,
    example: 'Where do we meet on Saturday morning?',
  })
  @IsString()
  @Length(1, MAX_FORUM_THREAD_TITLE_LENGTH)
  title!: string;

  @ApiProperty({
    maxLength: MAX_FORUM_POST_LENGTH,
    description: 'The first post of the thread.',
  })
  @IsString()
  @Length(1, MAX_FORUM_POST_LENGTH)
  body!: string;
}

/** What a participant sends to reply. */
export class NewForumPostDto implements NewForumPost {
  @ApiProperty({ maxLength: MAX_FORUM_POST_LENGTH })
  @IsString()
  @Length(1, MAX_FORUM_POST_LENGTH)
  body!: string;
}

/**
 * What a participant's list may be asked for: a window and nothing else.
 *
 * No `status` here, on purpose: the participant's lists are narrowed by the
 * rule of E51 in the statement, and a parameter that changed nothing would be a
 * promise the endpoint does not keep — so it is a 400 instead.
 */
export class ForumPageQueryDto implements ForumPageQuery {
  @ApiProperty({ required: false, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: MAX_FORUM_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_FORUM_PAGE_SIZE)
  pageSize?: number;
}

/** What the moderation list may be asked for: the window, and one state. */
export class ForumModerationQueryDto
  extends ForumPageQueryDto
  implements ForumModerationQuery
{
  @ApiProperty({ required: false, enum: FORUM_POST_STATUSES })
  @IsOptional()
  @IsIn(FORUM_POST_STATUSES)
  status?: ForumPostStatus;
}
