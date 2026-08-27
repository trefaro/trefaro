import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config';
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
 * `ProgramModule` and `MediaLinksModule` are deliberately *not* imported: the
 * dashboard needs numbers about a programme and a media list, not either of
 * them, and it gets those through the narrow `PROGRAM_TALLY` and
 * `MEDIA_LINK_TALLY` ports the data access layer binds globally. What it does
 * import is `ConfigurationModule`, to ask whether an optional module is switched
 * on before showing a tile that leads to it (FR 1.5, F53).
 *
 * What arrives here later: the tile for new messages (phase 3) and the tiles the
 * programme proposal and forum plug-ins bring (phase 4).
 */
@Module({
  imports: [
    ConfigurationModule,
    EventsModule,
    EventSeriesModule,
    RegistrationModule,
  ],
  controllers: [AdminEventDashboardController],
  providers: [EventDashboardService],
  exports: [EventDashboardService],
})
export class DashboardModule {}
