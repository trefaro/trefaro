import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { Subject, of } from 'rxjs';
import { AppConfigService } from '@trefaro/shared-config';
import { PushSubscriptionService } from './push-subscription.service';

/** Stand-in for Angular's SwPush, which needs a real service worker. */
class FakeSwPush {
  isEnabled = true;
  currentSubscription: PushSubscription | null = null;
  unsubscribed = false;
  readonly notificationClicks = new Subject<never>();

  /**
   * A factory rather than a stored promise: a rejected promise created in the
   * constructor and never awaited surfaces as an unhandled rejection.
   */
  onRequestSubscription: () => Promise<PushSubscription> = () =>
    Promise.reject(new Error('the test did not configure a subscription'));

  requestSubscription(): Promise<PushSubscription> {
    return this.onRequestSubscription();
  }

  get subscription() {
    return of(this.currentSubscription);
  }

  async unsubscribe(): Promise<void> {
    this.unsubscribed = true;
  }
}

/** Mirrors what the browser hands back, `expirationTime` included. */
function browserSubscription(endpoint: string): PushSubscription {
  return {
    endpoint,
    toJSON: () => ({
      endpoint,
      expirationTime: null,
      keys: { p256dh: 'client-public-key', auth: 'client-auth-secret' },
    }),
  } as unknown as PushSubscription;
}

describe('PushSubscriptionService', () => {
  let swPush: FakeSwPush;
  let service: PushSubscriptionService;
  let http: HttpTestingController;

  function configure(
    options: { publicKey?: string | null; enabled?: boolean } = {},
  ) {
    swPush = new FakeSwPush();
    swPush.isEnabled = options.enabled ?? true;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SwPush, useValue: swPush },
        {
          provide: AppConfigService,
          useValue: {
            webPushPublicKey: () =>
              options.publicKey === undefined
                ? 'server-vapid-public-key'
                : options.publicKey,
          },
        },
      ],
    });
    service = TestBed.inject(PushSubscriptionService);
    http = TestBed.inject(HttpTestingController);
  }

  it('reports push as unsupported without an active service worker', () => {
    configure({ enabled: false });

    expect(service.state()).toBe('unsupported');
    expect(service.canSubscribe()).toBe(false);
  });

  it('reports push as not configured when the instance has no VAPID key', () => {
    configure({ publicKey: null });

    expect(service.state()).toBe('not-configured');
    expect(service.canSubscribe()).toBe(false);
  });

  it('offers subscribing once a service worker and a key are both present', () => {
    configure();

    expect(service.state()).toBe('unsubscribed');
    expect(service.canSubscribe()).toBe(true);
  });

  it("sends only the endpoint and keys, not the browser's extra fields", async () => {
    configure();
    swPush.onRequestSubscription = () =>
      Promise.resolve(browserSubscription('https://push.example.org/abc'));

    const subscribing = service.subscribe();
    // Give requestSubscription's promise a turn before the request is asserted.
    await Promise.resolve();
    const request = http.expectOne('/api/user/push/subscriptions');
    request.flush(null);
    await subscribing;

    expect(request.request.body).toEqual({
      endpoint: 'https://push.example.org/abc',
      keys: { p256dh: 'client-public-key', auth: 'client-auth-secret' },
    });
    // The API rejects unknown fields, so expirationTime must not be sent.
    expect(request.request.body).not.toHaveProperty('expirationTime');
    expect(service.state()).toBe('subscribed');
  });

  it('distinguishes a declined permission prompt from a failure', async () => {
    configure();
    swPush.onRequestSubscription = () =>
      Promise.reject(new Error('Notification permission denied by the user'));

    await service.subscribe();

    expect(service.state()).toBe('denied');
    expect(service.canSubscribe()).toBe(false);
    http.verify();
  });

  it('keeps the subscribe action available after a transient failure', async () => {
    configure();
    swPush.onRequestSubscription = () =>
      Promise.reject(new Error('push service unreachable'));

    await service.subscribe();

    expect(service.state()).toBe('unsubscribed');
    expect(service.canSubscribe()).toBe(true);
    expect(service.error()).toContain('push service unreachable');
  });

  it('tells the server before it drops the local subscription', async () => {
    configure();
    swPush.currentSubscription = browserSubscription(
      'https://push.example.org/abc',
    );

    const unsubscribing = service.unsubscribe();
    await Promise.resolve();
    const request = http.expectOne('/api/user/push/subscriptions');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({
      endpoint: 'https://push.example.org/abc',
    });
    request.flush(null);
    await unsubscribing;

    expect(swPush.unsubscribed).toBe(true);
  });

  it('does nothing on unsubscribe when this browser never subscribed', async () => {
    configure();

    await service.unsubscribe();

    expect(swPush.unsubscribed).toBe(false);
    http.verify();
  });
});
