import { Module } from '@nestjs/common';
import { AdminEventSeriesController } from './admin-event-series.controller';
import { EventSeriesService } from './event-series.service';
import { PublicEventSeriesController } from './public-event-series.controller';

/**
 * Event series — the unit an organization plans in (UC 02, UC 03).
 *
 * Create and manage series with name, description and logo (FR 2.1, FR 2.2);
 * listing a series' upcoming and past events (FR 2.3) follows with the events
 * themselves in AP 3, and inviting former participants (FR 2.4) in AP 12, once
 * there are registrations to draw the addresses from.
 *
 * Two controllers on purpose: one behind the administrative guard, one public.
 * The split is what keeps a draft series invisible without a flag being checked
 * in the wrong place.
 */
@Module({
  controllers: [AdminEventSeriesController, PublicEventSeriesController],
  providers: [EventSeriesService],
  exports: [EventSeriesService],
})
export class EventSeriesModule {}
