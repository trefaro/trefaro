import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminProposalsController } from './api/admin-proposals.controller';
import { ParticipantProposalsController } from './api/participant-proposals.controller';
import { PROPOSAL_REPOSITORY } from './business/ports/proposal.repository';
import { ProgramProposalsService } from './business/program-proposals.service';
import { ProposalEntity } from './data-access/entities/proposal.entity';
import { TypeormProposalRepository } from './data-access/typeorm-proposal.repository';

/**
 * The programme proposals plug-in as one NestJS module.
 *
 * It wires its own three parts together — two API controllers, one business
 * service and its own data access repository — and binds its own port to its own
 * implementation. The core learns nothing about proposals beyond what the
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
 * module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ProposalEntity])],
  controllers: [ParticipantProposalsController, AdminProposalsController],
  providers: [
    ProgramProposalsService,
    TypeormProposalRepository,
    { provide: PROPOSAL_REPOSITORY, useExisting: TypeormProposalRepository },
  ],
})
export class ProgramProposalsModule {}
