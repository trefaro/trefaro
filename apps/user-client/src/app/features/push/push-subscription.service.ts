import {
  DOCUMENT,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '@trefaro/shared-config';
import { ApiClient } from '@trefaro/shared-http';
import { ParticipantSessionService } from '../auth/participant-session.service';

export type PushState =
  | 'unsupported'
  | 'not-configured'
  | 'unsubscribed'
  | 'subscribing'
  | 'subscribed'
  | 'denied';

/** Remembers a "not now", so the offer asks once and not on every page. */
const STORAGE_KEY = 'trefaro.push.dismissed';

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
 *
 * Three things AP 11 added, and each of them is a rule rather than a
 * convenience:
 *
 * 1. **The permission is read, not guessed.** `Notification.permission` says
 *    whether this browser has already refused, and reading it prompts nobody.
 *    Without it the only way to find out would be to trigger the dialogue and
 *    catch the rejection — which is asking a question that was already
 *    answered, and the answer was no.
 * 2. **The offer can be declined for good.** Kept in `localStorage`, like the
 *    installation hint's "not now" (F109): nothing on the server reads it and
 *    it has to outlive a session.
 * 3. **A subscription follows the session** (E43). Signing in re-posts it, so
 *    the row is bound to that account and personal notifications can reach it;
 *    signing out re-posts it with no cookie, and the server unbinds it. The
 *    endpoint is the identity of the row, so this rebinds rather than
 *    duplicates — and a shared device stops carrying somebody's conversations
 *    the moment they leave.
 */
@Injectable({ providedIn: 'root' })
export class PushSubscriptionService {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(ApiClient);
  private readonly config = inject(AppConfigService);
  private readonly session = inject(ParticipantSessionService);
  private readonly view = inject(DOCUMENT).defaultView;

  private readonly progress = signal<PushState | null>(null);
  private readonly failure = signal<string | null>(null);
  private readonly subscribed = signal(false);
  private readonly dismissed = signal(this.wasDismissed());
  private readonly permission = signal(this.currentPermission());

  /**
   * The account the stored subscription is bound to, as far as this tab knows.
   *
   * `undefined` means "never posted from here", which is different from `null`
   * ("posted while nobody was signed in") — the first has to be corrected, the
   * second is already right.
   */
  private syncedOwner: string | null | undefined = undefined;

  readonly error = this.failure.asReadonly();

  /** Clicks on a delivered notification, carrying the in-app path to open. */
  readonly notificationClicks = this.swPush.notificationClicks;

  readonly state = computed<PushState>(() => {
    const explicit = this.progress();
    if (explicit) return explicit;
    // No service worker: a development build, or a browser without support.
    if (!this.swPush.isEnabled) return 'unsupported';
    // The organization has not generated a VAPID key pair — or has the push
    // module switched off, in which case `/api/config` withholds the key (F53).
    if (!this.config.webPushPublicKey()) return 'not-configured';
    if (this.subscribed()) return 'subscribed';
    return this.permission() === 'denied' ? 'denied' : 'unsubscribed';
  });

  readonly canSubscribe = computed(() => this.state() === 'unsubscribed');

  /**
   * Whether to offer notifications unasked (NFR 4).
   *
   * Only where the offer can be followed, and only until somebody says no. A
   * banner that leads to a dialogue the browser has already refused, or that
   * comes back on every page after a "not now", is the kind of thing people
   * learn to look past.
   */
  readonly offering = computed(
    () => this.state() === 'unsubscribed' && !this.dismissed(),
  );

  /** Whether the browser has refused, which no button of ours can undo. */
  readonly blocked = computed(() => this.state() === 'denied');

  constructor() {
    // What the browser holds, rather than what this tab did: a subscription
    // survives a reload, and another tab may have made or dropped one.
    this.swPush.subscription
      .pipe(takeUntilDestroyed())
      .subscribe((subscription) => {
        this.subscribed.set(subscription !== null);
      });

    // A subscription belongs to whoever is signed in on this device (E43).
    // Guarded on `subscribed`, so a browser that never subscribed posts
    // nothing when somebody signs in.
    effect(() => {
      const owner = this.session.participant()?.id ?? null;
      if (!this.subscribed()) return;
      if (this.syncedOwner === owner) return;

      this.syncedOwner = owner;
      void this.rebind();
    });
  }

  /**
   * Asks the browser for permission and stores what it hands back.
   *
   * The explanation belongs on the screen **before** this is called (NFR 4):
   * the browser's own dialogue says nothing about what an organization would
   * send, and a permission somebody granted without knowing that is one they
   * revoke at the first notification.
   */
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

      await this.post(subscription.endpoint, {
        p256dh: keys['p256dh'],
        auth: keys['auth'],
      });

      // Set before the state, so the ownership effect sees a subscription that
      // is already bound and does not post it a second time.
      this.syncedOwner = this.session.participant()?.id ?? null;
      this.subscribed.set(true);
      this.progress.set(null);
    } catch (error) {
      // A refused permission prompt is a decision, not a fault: it must be
      // distinguishable from a failure so the UI does not invite a retry.
      this.progress.set(null);
      this.permission.set(this.currentPermission());
      const denied =
        error instanceof Error && /denied|permission/i.test(error.message);
      if (denied) this.permission.set('denied');
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
      this.syncedOwner = undefined;
      this.subscribed.set(false);
      this.progress.set(null);
    } catch (error) {
      this.failure.set(error instanceof Error ? error.message : String(error));
    }
  }

  /** "Not now", remembered — the offer does not come back on the next visit. */
  dismiss(): void {
    this.dismissed.set(true);
    try {
      this.view?.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Private mode, or storage switched off. The offer is then declined for
      // this visit only, which is the harmless direction to fail in.
    }
  }

  /**
   * Re-posts the stored subscription so the server can rebind it (E43).
   *
   * Silent on failure: nobody asked for this, it happens on signing in and
   * out, and the consequence of a lost race is a device that keeps getting
   * public event changes and no personal ones — which the next sign-in fixes.
   */
  private async rebind(): Promise<void> {
    try {
      const subscription = await firstValueFrom(this.swPush.subscription);
      const keys = subscription?.toJSON().keys;
      if (!subscription || !keys?.['p256dh'] || !keys['auth']) return;

      await this.post(subscription.endpoint, {
        p256dh: keys['p256dh'],
        auth: keys['auth'],
      });
    } catch {
      this.syncedOwner = undefined;
    }
  }

  /**
   * Sends what the browser handed over, field by field.
   *
   * Not `subscription.toJSON()`: that object also carries `expirationTime`,
   * and the API rejects unknown fields rather than dropping them silently.
   */
  private async post(
    endpoint: string,
    keys: { p256dh: string; auth: string },
  ): Promise<void> {
    await firstValueFrom(
      this.api.post<void>('user/push/subscriptions', { endpoint, keys }),
    );
  }

  private currentPermission(): NotificationPermission | null {
    try {
      const notification = this.view?.Notification;
      return notification ? notification.permission : null;
    } catch {
      // Some browsers throw on `Notification` in an insecure context.
      return null;
    }
  }

  private wasDismissed(): boolean {
    try {
      return this.view?.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
