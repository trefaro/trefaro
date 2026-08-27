import { Module } from '@nestjs/common';
import { EventsModule } from '../events';
import { AdminEventProgramItemsController } from './admin-event-program-items.controller';
import { AdminProgramItemsController } from './admin-program-items.controller';
import { ProgramService } from './program.service';
import { PublicProgramController } from './public-program.controller';

/**
 * Programme items and the schedule (FR 3.7, FR 3.6, UC 11).
 *
 * Programme planning with topic, abstract, speaker and schedule, plus the
 * timeline a participant reads on the landing page. Per-item sign-up (FR 3.10)
 * and the sign-up counts the room plug-in reads for its overbooking check
 * follow in AP 9; per-field content translations (FR 3.12) in phase 2.
 *
 * Imports `EventsModule` because every rule here needs the event: whether the
 * organizer may see it, whether a participant may, and whether an item fits
 * inside its period. Duplicating any of those would be how the two drift apart.
 *
 * What this module knows nothing about is rooms (F21). The room a session
 * happens in lives in the room planning plug-in's own join table, and the
 * exports below are what that plug-in will read through a versioned port in
 * AP 9 — never through this module's tables.
 */
@Module({
  imports: [EventsModule],
  controllers: [
    AdminEventProgramItemsController,
    AdminProgramItemsController,
    PublicProgramController,
  ],
  providers: [ProgramService],
  exports: [ProgramService],
})
export class ProgramModule {}
