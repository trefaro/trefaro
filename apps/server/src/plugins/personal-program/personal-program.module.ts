import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParticipantProgramController } from './api/participant-program.controller';
import { PersonalProgramService } from './business/personal-program.service';
import { PLAN_REPOSITORY } from './business/ports/plan.repository';
import { PlanEntryEntity } from './data-access/entities/plan-entry.entity';
import { TypeormPlanRepository } from './data-access/typeorm-plan.repository';

/**
 * The personal programme plug-in as one NestJS module.
 *
 * It wires its own three parts together — one API controller, one business
 * service and its own data access repository — and binds its own port to its
 * own implementation. The core learns nothing about anybody's plan beyond what
 * the plug-in descriptor declares.
 *
 * **One controller**, where the check-in has three: this plug-in has exactly
 * one audience. A plan belongs to the person who made it, so there is no
 * anonymous half to publish and nothing for an organizer to read — who means to
 * attend what is not an attendance list (E55), and turning it into one would be
 * a product decision taken inside a plug-in.
 *
 * What it does *not* import is a core module. The one thing it needs from the
 * host — the sessions of an event, translated for whoever is reading (E56) —
 * arrives through a token from `plugin-api`, provided by the global plug-in
 * host module. The fifth plug-in of this phase, and the fourth to need nothing
 * new from the contract to be built.
 */
@Module({
  imports: [TypeOrmModule.forFeature([PlanEntryEntity])],
  controllers: [ParticipantProgramController],
  providers: [
    PersonalProgramService,
    TypeormPlanRepository,
    { provide: PLAN_REPOSITORY, useExisting: TypeormPlanRepository },
  ],
})
export class PersonalProgramModule {}
