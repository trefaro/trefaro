import { Module } from '@nestjs/common';
import { EventSeriesModule } from '../event-series';
import { EventsModule } from '../events';
import { ProgramModule } from '../program';
import {
  AdminEventTranslationsController,
  AdminProgramItemTranslationsController,
  AdminSeriesTranslationsController,
} from './admin-content-translations.controller';
import { ContentTranslationsService } from './content-translations.service';

/**
 * Translating the content an organization writes (FR 3.12, UC 12, E25).
 *
 * Above its three parts rather than inside any of them (F49): translating needs
 * the series, the event and the programme in order to refuse an unknown id the
 * same way each of them does, and a translation service living in `EventsModule`
 * would have closed a circle with the programme and needed a `forwardRef`.
 *
 * The direction of the dependency is the point. The three modules below know
 * nothing about this one: each reads only the *reading* half of its own
 * translation port, which is what makes it impossible for a service that renders
 * a landing page to write a translation.
 */
@Module({
  imports: [EventSeriesModule, EventsModule, ProgramModule],
  controllers: [
    AdminSeriesTranslationsController,
    AdminEventTranslationsController,
    AdminProgramItemTranslationsController,
  ],
  providers: [ContentTranslationsService],
  exports: [ContentTranslationsService],
})
export class ContentTranslationsModule {}
