import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as webPush from 'web-push';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';
import type { PushDeliveryReport, PushNotification } from './push-notification';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  type PushSubscriptionInput,
  type PushSubscriptionRepository,
} from './ports/push-subscription.repository';

/** Status codes with which a push service declares a subscription dead. */
const GONE_STATUS_CODES = new Set([404, 410]);

/**
 * Self-hosted Web Push (F7).
 *
 * The instance signs its own messages with a VAPID key pair, so notifications
 * work without Firebase or any other third-party push service (NFR 9). On iOS
 * this only works for an installed PWA — accepted when the decision was made.
 *
 * Push stays optional: an instance without a key pair starts normally and
 * simply reports push as unavailable.
 */
@Injectable()
export class PushService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @Inject(ENV) private readonly env: TrefaroEnv,
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: PushSubscriptionRepository,
  ) {}

  onApplicationBootstrap(): void {
    const config = this.env.webPush;
    if (!config) {
      this.logger.log(
        'Web Push disabled — set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to enable it',
      );
      return;
    }
    webPush.setVapidDetails(
      config.subject,
      config.publicKey,
      config.privateKey,
    );
    this.logger.log('Web Push enabled');
  }

  isConfigured(): boolean {
    return this.env.webPush !== null;
  }

  async subscribe(input: PushSubscriptionInput): Promise<void> {
    this.assertConfigured();
    await this.subscriptions.save(input);
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.subscriptions.deleteByEndpoint(endpoint);
  }

  /**
   * Sends a notification to every stored subscription.
   *
   * One failing endpoint must not abort the rest, so deliveries run
   * independently and the result is reported as counts. Subscriptions the push
   * service declares gone are removed — otherwise the table grows with every
   * uninstalled browser.
   */
  async broadcast(notification: PushNotification): Promise<PushDeliveryReport> {
    this.assertConfigured();

    const targets = await this.subscriptions.findAll();
    const payload = JSON.stringify({
      notification: {
        title: notification.title,
        body: notification.body,
        data: notification.url ? { url: notification.url } : undefined,
      },
    });

    let delivered = 0;
    let failed = 0;
    let expired = 0;

    await Promise.all(
      targets.map(async (target) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: target.endpoint,
              keys: { p256dh: target.p256dhKey, auth: target.authKey },
            },
            payload,
          );
          delivered += 1;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode !== undefined && GONE_STATUS_CODES.has(statusCode)) {
            await this.subscriptions.deleteByEndpoint(target.endpoint);
            expired += 1;
            return;
          }
          failed += 1;
          this.logger.warn(
            `Push delivery failed with status ${statusCode ?? 'unknown'}`,
          );
        }
      }),
    );

    return { delivered, failed, expired };
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Web Push is not configured on this instance',
      );
    }
  }
}
