import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments';
import { LogoFilesModule } from '../logo-files';
import { AdminEventSeriesController } from './admin-event-series.controller';
import { AdminSeriesLogoController } from './admin-series-logo.controller';
import { EventSeriesService } from './event-series.service';
import { PublicEventSeriesController } from './public-event-series.controller';
import { SeriesLogoMediaController } from './series-logo-media.controller';

/**
 * Event series — the unit an organization plans in (UC 02, UC 03).
 *
 * Create and manage series with name, description and logo (FR 2.1, FR 2.2);
 * listing a series' upcoming and past events (FR 2.3) follows with the events
 * themselves in AP 3, and inviting former participants (FR 2.4) in AP 12, once
 * there are registrations to draw the addresses from.
 *
 * Controllers split by who may reach them: two behind the administrative guard,
 * two public. The split is what keeps a draft series invisible without a flag
 * being checked in the wrong place. The logo has one of each (FR 2.1) — the
 * upload is a multipart request of its own shape, and the picture has to be
 * readable without a login.
 */
@Module({
  // Deleting a series cascades to its registrations; their files have to be
  // removed before the rows that name them are (E9). `LogoFilesModule` is the
  // same promise for the logo of this series and of each of its events (FR 2.1).
  imports: [AttachmentsModule, LogoFilesModule],
  controllers: [
    AdminEventSeriesController,
    AdminSeriesLogoController,
    PublicEventSeriesController,
    SeriesLogoMediaController,
  ],
  providers: [EventSeriesService],
  exports: [EventSeriesService],
})
export class EventSeriesModule {}
