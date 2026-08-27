import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config';
import { EventsModule } from '../events';
import { ProgramModule } from '../program';
import { AdminEventMediaLinksController } from './admin-event-media-links.controller';
import { AdminMediaLinksController } from './admin-media-links.controller';
import { MediaLinksService } from './media-links.service';
import { PublicMediaLinksController } from './public-media-links.controller';

/**
 * External stream and media library links (FR 3.6, F10) — AP 11.
 *
 * Stores URLs per event and per programme item — streams, recordings and
 * materials — and nothing else: no upload, no transcoding, no player (F10,
 * variant a). This resolves the "streaming" box of the thesis' building block
 * view, which the functional requirements never specified.
 *
 * The first *optional* core module with an API. Every core module is mounted
 * whether it is enabled or not, exactly as every curated plug-in is; the flag in
 * `module_config` decides whether the endpoints answer, and the guard that
 * enforces that comes from `ConfigurationModule` (F53).
 *
 * `EventsModule` because every rule here needs the event — whether the organizer
 * may see it, whether a participant may. `ProgramModule` because a link may hang
 * on a session, and whether that session belongs to this event is the programme's
 * to answer. Neither dependency is reversed: nothing in the core asks this module
 * anything, which is what makes it switchable in the first place.
 *
 * The follow-up text FR 3.6 asks for in the same breath is *not* here: it is one
 * column on the event, written and read with the event, and shown once the event
 * has ended (F50). A module that can be switched off must not be able to take a
 * field of the event with it.
 */
@Module({
  imports: [ConfigurationModule, EventsModule, ProgramModule],
  controllers: [
    AdminEventMediaLinksController,
    AdminMediaLinksController,
    PublicMediaLinksController,
  ],
  providers: [MediaLinksService],
  exports: [MediaLinksService],
})
export class MediaLinksModule {}
