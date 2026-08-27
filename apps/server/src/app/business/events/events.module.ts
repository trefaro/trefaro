import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments';
import { EventSeriesModule } from '../event-series';
import { AdminEventsController } from './admin-events.controller';
import { AdminSeriesEventsController } from './admin-series-events.controller';
import { EventsService } from './events.service';
import { PublicEventsController } from './public-events.controller';

/**
 * Events within a series (UC 04, UC 05, UC 10).
 *
 * Create and edit events including the presence, online and hybrid types
 * (FR 3.1, FR 3.2, FR 3.9), the events of a series (FR 2.3) and the public
 * landing page (FR 3.6). The organizer dashboard (FR 3.8) is a composition of
 * this module and three others and therefore lives above them, in
 * `business/dashboard`; per-field content translations (FR 3.12) follow in
 * phase 2, push on change (FR 3.15) in phase 3.
 *
 * Imports `EventSeriesModule` because an event is only public if its series is:
 * the rule needs both, and duplicating the series' visibility check here is how
 * the two would drift apart. And `AttachmentsModule`, because deleting an event
 * has to take the uploaded files with it — the database cascade removes the
 * rows and leaves the bytes (E9).
 */
@Module({
  imports: [EventSeriesModule, AttachmentsModule],
  controllers: [
    AdminSeriesEventsController,
    AdminEventsController,
    PublicEventsController,
  ],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
