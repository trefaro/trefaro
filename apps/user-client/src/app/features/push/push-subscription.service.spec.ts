import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject, Subject } from 'rxjs';
import { signal } from '@angular/core';
import { AppConfigService } from '@trefaro/shared-config';
import { ParticipantSessionService } from '../auth/participant-session.service';
import { PushSubscriptionService } from './push-subscription.service';

/** Stand-in for Angular's SwPush, which needs a real service worker. */
class FakeSwPush {
  isEnabled = true;
  unsubscribed = false;
  readonly notificationClicks = new Subject<never>();

  /**
   * What the browser holds, as a subject rather than a value.
   *
   * The service subscribes once and follows it, because a subscription
   * survives a reload and another tab may have made one — so a test that
   * needs the service to *know* about one has to push it in here.
   */
  readonly held = new BehaviorSubject<PushSubscription | null>(null);

  get currentSubscription(): PushSubscription | null {
    return this.held.value;
  }

  set currentSubscription(subscription: PushSubscription | null) {
    this.held.next(subscription);
  }

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
    return this.held.asObservable();
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

/**
 * What the browser says about the notification permission.
 *
 * Defined on the window rather than passed in, because that is where the
 * service reads it — and read in the constructor, so it has to be in place
 * before the service is injected. Put back afterwards: a test file must not
 * leave a `Notification` behind for whatever runs in the same environment.
 *
 * `localStorage` is the real one jsdom provides and is cleared per test, like
 * the installation hint's suite does it.
 */
let permission: NotificationPermission = 'default';
const NO_NOTIFICATION_API = Symbol('absent');
let previousNotification: unknown = NO_NOTIFICATION_API;

beforeAll(() => {
  previousNotification =
    'Notification' in window
      ? (window as unknown as { Notification: unknown }).Notification
      : NO_NOTIFICATION_API;
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: {
      get permission() {
        return permission;
      },
    },
  });
});

afterAll(() => {
  if (previousNotification === NO_NOTIFICATION_API) {
    delete (window as unknown as { Notification?: unknown }).Notification;
    return;
  }
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: previousNotification,
  });
});

describe('PushSubscriptionService', () => {
  let swPush: FakeSwPush;
  let service: PushSubscriptionService;
  let http: HttpTestingController;
  let participant: ReturnType<typeof signal<{ id: string } | null>>;

  afterEach(() => localStorage.clear());

  function configure(
    options: {
      publicKey?: string | null;
      enabled?: boolean;
      /** Who is signed in on this device, if anybody (E43). */
      participant?: { id: string } | null;
      /** What the browser answers about the notification permission. */
      permission?: NotificationPermission;
      dismissed?: boolean;
    } = {},
  ) {
    swPush = new FakeSwPush();
    swPush.isEnabled = options.enabled ?? true;
    participant = signal<{ id: string } | null>(options.participant ?? null);

    // Read straight off `window` by the service, so this is where a browser
    // that has already refused, or a "not now" from an earlier visit, is
    // stated.
    localStorage.clear();
    if (options.dismissed) {
      localStorage.setItem('trefaro.push.dismissed', 'true');
    }
    permission = options.permission ?? 'default';

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
        {
          provide: ParticipantSessionService,
          useValue: { participant },
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

  describe('the offer', () => {
    it('is made where it can be followed', () => {
      configure();

      expect(service.offering()).toBe(true);
    });

    it('is not made where the browser has already refused', () => {
      configure({ permission: 'denied' });

      // Read rather than found out by triggering the dialogue: that question
      // was asked once and answered no.
      expect(service.state()).toBe('denied');
      expect(service.offering()).toBe(false);
      expect(service.blocked()).toBe(true);
    });

    it('is not made again after a "not now" from an earlier visit', () => {
      configure({ dismissed: true });

      expect(service.state()).toBe('unsubscribed');
      expect(service.offering()).toBe(false);
    });

    it('stops for good the moment it is declined', () => {
      configure();

      service.dismiss();

      expect(service.offering()).toBe(false);
      expect(localStorage.getItem('trefaro.push.dismissed')).toBe('true');
    });

    it('is not made where the instance does not do push at all', () => {
      configure({ publicKey: null });

      expect(service.offering()).toBe(false);
    });
  });

  describe('whose device this is (E43)', () => {
    const held = () => browserSubscription('https://push.example.org/abc');

    /**
     * Lets the rebind reach the network.
     *
     * The effect runs on `tick`, but reading what the browser holds is a
     * promise — so the request exists a turn of the microtask queue later.
     */
    const settled = async () => {
      TestBed.tick();
      await Promise.resolve();
      await Promise.resolve();
    };

    it('re-posts the subscription when somebody signs in', async () => {
      configure();
      swPush.currentSubscription = held();
      // The state the service starts in: a browser with a subscription and
      // nobody signed in. That first post is the unbinding one.
      await settled();
      http.expectOne('/api/user/push/subscriptions').flush(null);

      participant.set({ id: 'profile-1' });
      await settled();

      const request = http.expectOne('/api/user/push/subscriptions');
      // The server reads the cookie; the body is the same either way, which
      // is why one endpoint can bind and unbind.
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        endpoint: 'https://push.example.org/abc',
        keys: { p256dh: 'client-public-key', auth: 'client-auth-secret' },
      });
      request.flush(null);
    });

    it('re-posts it again when they sign out, so the row is unbound', async () => {
      configure({ participant: { id: 'profile-1' } });
      swPush.currentSubscription = held();
      await settled();
      http.expectOne('/api/user/push/subscriptions').flush(null);

      participant.set(null);
      await settled();

      http.expectOne('/api/user/push/subscriptions').flush(null);
      http.verify();
    });

    it('posts nothing when this browser has no subscription to rebind', async () => {
      configure();

      participant.set({ id: 'profile-1' });
      await settled();

      // Signing in does not subscribe anybody: that is a decision with a
      // browser dialogue in it.
      http.verify();
    });

    it('does not post twice for a subscription it has just made', async () => {
      configure({ participant: { id: 'profile-1' } });
      swPush.onRequestSubscription = () => Promise.resolve(held());

      const subscribing = service.subscribe();
      await Promise.resolve();
      http.expectOne('/api/user/push/subscriptions').flush(null);
      await subscribing;
      await settled();

      // The owner was recorded with the subscription, so the ownership effect
      // has nothing to correct.
      http.verify();
    });
  });
});
