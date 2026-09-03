import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config';
import { I18nModule } from '../i18n';
import { ProfilesModule } from '../profiles';
import { PushController } from './push.controller';
import { PushService } from './push.service';

/**
 * Push notification module (FR 3.15) — self-hosted Web Push, no third party.
 *
 * Three imports, three reasons, and each of them is a decision written down
 * somewhere else:
 *
 * - `ConfigurationModule` for the guard that turns a switched-off module into a
 *   404 (F53) — and, since AP 11, for the same registry read from *inside*
 *   the service: a notification is not triggered by a request, so nothing would
 *   ask the flag on its behalf (E21). The instance's default language comes
 *   from here too, for a device whose owner has never said (F125).
 * - `I18nModule` because a notification is text an organization maintains
 *   (E22). The mails stopped carrying their words in TypeScript in phase 2;
 *   notifications never started.
 * - `ProfilesModule` for one question on one endpoint: whether the browser
 *   posting a subscription is signed in (E43). Resolved through the service the
 *   participant guard uses, because there is one participant session and one
 *   place that knows how to read it (E34).
 */
@Module({
  imports: [ConfigurationModule, I18nModule, ProfilesModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
