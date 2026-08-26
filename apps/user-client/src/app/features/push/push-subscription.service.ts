import { Injectable, computed, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '@trefaro/shared-config';
import { ApiClient } from '@trefaro/shared-http';

export type PushState =
  | 'unsupported'
  | 'not-configured'
  | 'unsubscribed'
  | 'subscribing'
  | 'subscribed'
  | 'denied';

/**
 * Web Push subscription for the participant client (FR 3.15).
 *
 * Only the participant client subscribes — organizers send changes, they do not
 * receive them.
 *
 * Requires an active service worker, which Angular registers only in a
 * production build. On iOS it additionally requires the PWA to be installed to
 * the home screen; that limitation was accepted when Web Push was chosen as the
 * only push channel (F7).
 */
@Injectable({ providedIn: 'root' })
export class PushSubscriptionService {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(ApiClient);
  private readonly config = inject(AppConfigService);

  private readonly progress = signal<PushState | null>(null);
  private readonly failure = signal<string | null>(null);
  private readonly subscribed = signal(false);

  readonly error = this.failure.asReadonly();

  /** Clicks on a delivered notification, carrying the in-app path to open. */
  readonly notificationClicks = this.swPush.notificationClicks;

  readonly state = computed<PushState>(() => {
    const explicit = this.progress();
    if (explicit) return explicit;
    // No service worker: a development build, or a browser without support.
    if (!this.swPush.isEnabled) return 'unsupported';
    // The organization has not generated a VAPID key pair.
    if (!this.config.webPushPublicKey()) return 'not-configured';
    return this.subscribed() ? 'subscribed' : 'unsubscribed';
  });

  readonly canSubscribe = computed(() => this.state() === 'unsubscribed');

  async subscribe(): Promise<void> {
    const serverPublicKey = this.config.webPushPublicKey();
    if (!this.swPush.isEnabled || !serverPublicKey) return;

    this.progress.set('subscribing');
    this.failure.set(null);

    try {
      const subscription = await this.swPush.requestSubscription({
        serverPublicKey,
      });
      const keys = subscription.toJSON().keys;
      if (!keys?.['p256dh'] || !keys['auth']) {
        throw new Error('The browser returned a subscription without keys');
      }

      // Sent field by field rather than as `subscription.toJSON()`: that object
      // also carries `expirationTime`, and the API rejects unknown fields.
      await firstValueFrom(
        this.api.post<void>('user/push/subscriptions', {
          endpoint: subscription.endpoint,
          keys: { p256dh: keys['p256dh'], auth: keys['auth'] },
        }),
      );

      this.subscribed.set(true);
      this.progress.set(null);
    } catch (error) {
      // A refused permission prompt is a decision, not a fault: it must be
      // distinguishable from a failure so the UI does not invite a retry.
      const denied =
        error instanceof Error && /denied|permission/i.test(error.message);
      this.progress.set(denied ? 'denied' : null);
      this.failure.set(error instanceof Error ? error.message : String(error));
    }
  }

  async unsubscribe(): Promise<void> {
    try {
      const subscription = await firstValueFrom(this.swPush.subscription);
      if (subscription) {
        await firstValueFrom(
          this.api.delete<void>('user/push/subscriptions', {
            endpoint: subscription.endpoint,
          }),
        );
        await this.swPush.unsubscribe();
      }
      this.subscribed.set(false);
      this.progress.set(null);
    } catch (error) {
      this.failure.set(error instanceof Error ? error.message : String(error));
    }
  }
}
