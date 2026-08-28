import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config';
import { PushController } from './push.controller';
import { PushService } from './push.service';

/**
 * Push notification module (FR 3.15) — self-hosted Web Push, no third party.
 *
 * `ConfigurationModule` for the guard that turns a switched-off module into a
 * 404 (F53): `push` is the second optional core module with an API of its own,
 * and the flag has to gate it rather than only hide it from `/api/config` (E21).
 */
@Module({
  imports: [ConfigurationModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
