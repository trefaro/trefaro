import { Module } from '@nestjs/common';
import { EventSeriesModule } from '../event-series';
import { EventsModule } from '../events';
import { RegistrationModule } from '../registration';
import { AdminEventDashboardController } from './admin-event-dashboard.controller';
import { EventDashboardService } from './event-dashboard.service';

/**
 * The organizer's dashboard for one event (FR 3.8, UC 05).
 *
 * A module of its own rather than a service inside `EventsModule`, and that is
 * the whole reason it exists as a folder: the dashboard needs the registration
 * module, and the registration module needs the events module. Putting the
 * dashboard next to the events would close that circle and force a
 * `forwardRef`, which is how a module graph stops being readable. A composition
 * belongs above the things it composes.
 *
 * `ProgramModule` is deliberately *not* imported: the dashboard needs three
 * numbers about the programme, not the programme, and it gets them through the
 * narrow `PROGRAM_TALLY` port the data access layer binds globally.
 *
 * What arrives here later: the tile for new messages (phase 3) and the tiles the
 * programme proposal and forum plug-ins bring (phase 4).
 */
@Module({
  imports: [EventsModule, EventSeriesModule, RegistrationModule],
  controllers: [AdminEventDashboardController],
  providers: [EventDashboardService],
  exports: [EventDashboardService],
})
export class DashboardModule {}
