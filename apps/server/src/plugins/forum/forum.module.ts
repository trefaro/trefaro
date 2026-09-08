import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminForumController } from './api/admin-forum.controller';
import { ParticipantForumController } from './api/participant-forum.controller';
import { ForumService } from './business/forum.service';
import { FORUM_REPOSITORY } from './business/ports/forum.repository';
import { PostEntity } from './data-access/entities/post.entity';
import { ThreadEntity } from './data-access/entities/thread.entity';
import { TypeormForumRepository } from './data-access/typeorm-forum.repository';

/**
 * The discussion forum plug-in as one NestJS module.
 *
 * It wires its own three parts together — two API controllers, one business
 * service and its own data access repository — and binds its own port to its own
 * implementation. The core learns nothing about threads or posts beyond what the
 * plug-in descriptor declares.
 *
 * **Two controllers, one per access level** (E57). Not one controller with two
 * prefixes: the address is what decides which host guard runs, so a file that
 * mixed a participant's routes with an organizer's would be a file in which the
 * next route lands on the wrong side by accident.
 *
 * What it does *not* import is a core module. The two things it needs from the
 * host — who is asking and what an author is called (E58) — arrive through
 * tokens and decorators from `plugin-api`, provided by the global plug-in host
 * module. The same two things the proposals needed, through the same port,
 * which is the proof this package owes the plan: AP 2 built nothing that fits
 * proposals only.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ThreadEntity, PostEntity])],
  controllers: [ParticipantForumController, AdminForumController],
  providers: [
    ForumService,
    TypeormForumRepository,
    { provide: FORUM_REPOSITORY, useExisting: TypeormForumRepository },
  ],
})
export class ForumModule {}
