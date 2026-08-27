import { Module } from '@nestjs/common';
import { EventsModule } from '../events';
import { AdminEventProgramItemsController } from './admin-event-program-items.controller';
import { AdminProgramItemsController } from './admin-program-items.controller';
import { ProgramSignupsService } from './program-signups.service';
import { ProgramService } from './program.service';
import { PublicProgramController } from './public-program.controller';

/**
 * Programme items and the schedule (FR 3.7, FR 3.6, UC 11).
 *
 * Programme planning with topic, abstract, speaker and schedule, the timeline a
 * participant reads on the landing page, and per-item sign-up (FR 3.10). The
 * sign-up *actions* live in {@link ProgramSignupsService} and are reached
 * through the self-service module in phase 1 (E11) and through the participant
 * login from phase 3 — this module holds the rules either way. Per-field content
 * translations (FR 3.12) follow in phase 2.
 *
 * Imports `EventsModule` because every rule here needs the event: whether the
 * organizer may see it, whether a participant may, and whether an item fits
 * inside its period. Duplicating any of those would be how the two drift apart.
 *
 * What this module knows nothing about is rooms (F21). The room a session
 * happens in lives in the room planning plug-in's own join table, and the
 * plug-in reads sessions and seat counts through the versioned port the plug-in
 * host module publishes (E12) — never through this module's tables.
 */
@Module({
  imports: [EventsModule],
  controllers: [
    AdminEventProgramItemsController,
    AdminProgramItemsController,
    PublicProgramController,
  ],
  providers: [ProgramService, ProgramSignupsService],
  exports: [ProgramService, ProgramSignupsService],
})
export class ProgramModule {}
