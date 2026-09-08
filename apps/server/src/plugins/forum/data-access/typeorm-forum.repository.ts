import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ForumPostStatus } from '@trefaro/shared-models';
import { Brackets, QueryFailedError, Repository } from 'typeorm';
import type { EntityManager } from 'typeorm';
import {
  UnknownForumEventError,
  type AddPostInput,
  type ForumRepository,
  type ForumSlice,
  type ForumWindow,
  type ModeratedPostRecord,
  type OpenThreadInput,
  type PostRecord,
  type ThreadPosts,
  type ThreadRecord,
} from '../business/ports/forum.repository';
import { PostEntity } from './entities/post.entity';
import { ThreadEntity } from './entities/thread.entity';

/** PostgreSQL's foreign-key-violation SQLSTATE. */
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * "This thread is visible to `:viewer`", as a clause on the `thread` alias.
 *
 * The one rule of F195 and E51 together, written once and used by every
 * participant read and by the reply: some post of the thread is published, or
 * some post of the thread is the viewer's own. Kept as one string so the three
 * statements cannot drift apart (F152) — a thread one can read is exactly a
 * thread one can reply into.
 */
const VISIBLE_TO_VIEWER = `EXISTS (
  SELECT 1 FROM "plugin_forum_post" visible
   WHERE visible."thread_id" = thread."id"
     AND (visible."status" = 'approved' OR visible."author_id" = :viewer)
)`;

/**
 * The plug-in's own data access implementation (FR 4.6).
 *
 * Everything a list does happens in SQL — the filter, the sort, the count and
 * the window — for the reason every other list of this application gives: a
 * service that reads all rows and slices the array afterwards is the version
 * that fails first at volume (F49).
 *
 * The visibility rules are part of the statements, not of a caller (F152):
 * {@link findThreadsForParticipant} cannot be asked for a stranger's
 * unpublished thread, {@link findPostsForParticipant} cannot hand out a
 * stranger's pending post, and {@link addPost} cannot write into a thread its
 * author could not read. Those are the mistakes that would publish a rejected
 * row or let somebody reply into a conversation nobody has published yet, so
 * they are made impossible rather than checked above.
 *
 * Sorting: threads by `last_post_at DESC`, posts within a thread by
 * `created_at ASC` (a conversation reads top-down), the moderation list by
 * `created_at DESC` (like the proposals' queue) — each with the id as the last
 * criterion, so two rows written in the same millisecond do not swap places
 * between two pages.
 */
@Injectable()
export class TypeormForumRepository implements ForumRepository {
  constructor(
    @InjectRepository(ThreadEntity)
    private readonly threads: Repository<ThreadEntity>,
    @InjectRepository(PostEntity)
    private readonly posts: Repository<PostEntity>,
  ) {}

  async findThreadsForParticipant(
    eventId: string,
    viewerId: string,
    window: ForumWindow,
  ): Promise<ForumSlice<ThreadRecord>> {
    const [rows, total] = await this.threads
      .createQueryBuilder('thread')
      .where('thread.eventId = :eventId', { eventId })
      .andWhere(VISIBLE_TO_VIEWER, { viewer: viewerId })
      .orderBy('thread.lastPostAt', 'DESC')
      .addOrderBy('thread.id', 'DESC')
      .skip(window.offset)
      .take(window.limit)
      .getManyAndCount();

    return { rows: rows.map(toThreadRecord), total };
  }

  openThread(
    input: OpenThreadInput,
  ): Promise<{ thread: ThreadRecord; post: PostRecord }> {
    // Thread and first post in one transaction: a thread without a post would
    // be visible to nobody and reachable by nothing. Thrown, not returned, if
    // anything fails — a `return` here would commit (tooling-traps.md).
    return this.threads.manager.transaction(async (manager) => {
      try {
        const thread = await manager.save(
          manager.create(ThreadEntity, {
            eventId: input.eventId,
            title: input.title,
            createdBy: input.authorId,
          }),
        );
        const post = await manager.save(
          manager.create(PostEntity, {
            threadId: thread.id,
            authorId: input.authorId,
            body: input.body,
            status: 'pending',
          }),
        );
        // Read back rather than trusting what `save` returned: the columns the
        // database filled in (`last_post_at`, the nullable decision pair) are
        // what the answer has to report.
        return {
          thread: toThreadRecord(
            await manager.findOneByOrFail(ThreadEntity, { id: thread.id }),
          ),
          post: toPostRecord(
            await manager.findOneByOrFail(PostEntity, { id: post.id }),
          ),
        };
      } catch (error: unknown) {
        // An event deleted between the page load and the submission: a 404
        // rather than a 500, and translating it here is what keeps the driver's
        // error code out of the business layer.
        if (!isForeignKeyViolation(error)) throw error;
        throw new UnknownForumEventError(input.eventId);
      }
    });
  }

  async findPostsForParticipant(
    threadId: string,
    viewerId: string,
    window: ForumWindow,
  ): Promise<ThreadPosts | null> {
    const thread = await this.visibleThread(threadId, viewerId);
    if (!thread) return null;

    const [rows, total] = await this.posts
      .createQueryBuilder('post')
      .where('post.threadId = :threadId', { threadId })
      // Approved posts of everyone, plus every post of the reader's own
      // whatever its status (E51) — in the statement, not in a caller.
      .andWhere(
        new Brackets((where) =>
          where
            .where('post.status = :approved', { approved: 'approved' })
            .orWhere('post.authorId = :viewer', { viewer: viewerId }),
        ),
      )
      .orderBy('post.createdAt', 'ASC')
      .addOrderBy('post.id', 'ASC')
      .skip(window.offset)
      .take(window.limit)
      .getManyAndCount();

    return {
      thread: toThreadRecord(thread),
      rows: rows.map(toPostRecord),
      total,
    };
  }

  async addPost(input: AddPostInput): Promise<PostRecord | null> {
    // The same question as reading: a thread one cannot see is a thread one
    // cannot reply into, and the answer to a guessed id is the same either way.
    const thread = await this.visibleThread(input.threadId, input.authorId);
    if (!thread) return null;

    try {
      const saved = await this.posts.save(
        this.posts.create({
          threadId: input.threadId,
          authorId: input.authorId,
          body: input.body,
          status: 'pending',
        }),
      );
      return toPostRecord(await this.posts.findOneByOrFail({ id: saved.id }));
    } catch (error: unknown) {
      // The thread went between the two statements: the same "no such thread"
      // the reader would have got a moment later.
      if (!isForeignKeyViolation(error)) throw error;
      return null;
    }
  }

  async findPostsForEvent(
    eventId: string,
    status: ForumPostStatus | undefined,
    window: ForumWindow,
  ): Promise<ForumSlice<ModeratedPostRecord>> {
    const builder = this.posts
      .createQueryBuilder('post')
      // The thread decides which event a post belongs to, and its title is
      // what lets the organizer read the post in context.
      .innerJoinAndMapOne(
        'post.thread',
        ThreadEntity,
        'thread',
        'thread.id = post.threadId',
      )
      .where('thread.eventId = :eventId', { eventId });
    if (status) builder.andWhere('post.status = :status', { status });

    const [rows, total] = await builder
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .skip(window.offset)
      .take(window.limit)
      .getManyAndCount();

    return { rows: rows.map(toModeratedRecord), total };
  }

  decide(
    postId: string,
    status: Exclude<ForumPostStatus, 'pending'>,
    decidedAt: Date,
    decidedBy: string,
  ): Promise<ModeratedPostRecord | null> {
    return this.posts.manager.transaction(async (manager) => {
      // Status and instant in one statement, because the check constraint
      // refuses any other combination — and `decided_by` beside them, because
      // that is what the three together mean (E51).
      const updated = await manager
        .createQueryBuilder()
        .update(PostEntity)
        .set({ status, decidedAt, decidedBy })
        .where('id = :postId', { postId })
        .execute();
      // Nothing was written, so there is nothing this commit could keep.
      if (!updated.affected) return null;

      const post = await manager.findOneByOrFail(PostEntity, { id: postId });

      // The thread's activity follows what is published (F195): recomputed
      // from the rows, not incremented — a correction from approved to
      // rejected has to move it back as well.
      await manager
        .createQueryBuilder()
        .update(ThreadEntity)
        .set({
          lastPostAt: () => `COALESCE(
            (SELECT MAX(published."created_at") FROM "plugin_forum_post" published
              WHERE published."thread_id" = "plugin_forum_thread"."id"
                AND published."status" = 'approved'),
            "plugin_forum_thread"."created_at")`,
        })
        .where('id = :threadId', { threadId: post.threadId })
        .execute();

      const thread = await manager.findOneByOrFail(ThreadEntity, {
        id: post.threadId,
      });
      return { ...toPostRecord(post), threadTitle: thread.title };
    });
  }

  /**
   * One thread, if this viewer may see it — `null` for "no" and for "no such
   * thread" alike.
   */
  private visibleThread(
    threadId: string,
    viewerId: string,
    manager: EntityManager = this.threads.manager,
  ): Promise<ThreadEntity | null> {
    return manager
      .createQueryBuilder(ThreadEntity, 'thread')
      .where('thread.id = :threadId', { threadId })
      .andWhere(VISIBLE_TO_VIEWER, { viewer: viewerId })
      .getOne();
  }
}

/**
 * The same three lines the proposals plug-in has, and knowingly so: two
 * plug-ins are two (F138). A third that needs to read a SQLSTATE is the one at
 * which this moves into the contract.
 */
function isForeignKeyViolation(error: unknown): boolean {
  const driverError =
    error instanceof QueryFailedError
      ? (error.driverError as { code?: string } | undefined)
      : undefined;
  return driverError?.code === FOREIGN_KEY_VIOLATION;
}

function toThreadRecord(row: ThreadEntity): ThreadRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.title,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    lastPostAt: row.lastPostAt,
  };
}

function toPostRecord(row: PostEntity): PostRecord {
  return {
    id: row.id,
    threadId: row.threadId,
    authorId: row.authorId,
    body: row.body,
    status: row.status,
    decidedAt: row.decidedAt,
    decidedBy: row.decidedBy,
    createdAt: row.createdAt,
  };
}

function toModeratedRecord(row: PostEntity): ModeratedPostRecord {
  if (!row.thread) {
    // Only reachable if the join above is ever removed; better a loud failure
    // than a moderation list of posts with no context.
    throw new Error(`Post ${row.id} was read without its thread`);
  }
  return { ...toPostRecord(row), threadTitle: row.thread.title };
}
