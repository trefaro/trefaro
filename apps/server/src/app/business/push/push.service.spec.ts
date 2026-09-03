import { ServiceUnavailableException } from '@nestjs/common';
import {
  PUSH_MODULE_KEY,
  type TranslationCatalogue,
} from '@trefaro/shared-models';
import * as webPush from 'web-push';
import { loadEnv } from '../../core/config/env';
import type {
  ConfigurationService,
  CoreModuleRegistryService,
} from '../config';
import type { CatalogueService } from '../i18n';
import type {
  PushSubscriptionInput,
  PushSubscriptionRecord,
  PushSubscriptionRepository,
  PushTarget,
} from './ports/push-subscription.repository';
import { ALL_PUSH_KEYS } from './push-texts';
import { PushService } from './push.service';

jest.mock('web-push');

const mockedWebPush = jest.mocked(webPush);

const pushEnv = loadEnv({
  VAPID_PUBLIC_KEY: 'public-key',
  VAPID_PRIVATE_KEY: 'private-key',
  VAPID_SUBJECT: 'mailto:ngo@example.org',
});

/**
 * One catalogue per language, keyed the way the resolution really is.
 *
 * `en:push.event.time` and `de:push.event.time` are enough to say which
 * language a device was written to in, which is the whole of F125 on this
 * side.
 */
const catalogueFor = (locale: string): TranslationCatalogue =>
  Object.fromEntries(
    ALL_PUSH_KEYS.map((key) => [key, `${locale}:${key} {{period}}{{place}}`]),
  );

class FakeSubscriptionRepository implements PushSubscriptionRepository {
  rows: PushTarget[] = [];
  forEvent: PushTarget[] | null = null;
  forParticipant: PushTarget[] | null = null;
  readonly asked: string[] = [];

  async save(input: PushSubscriptionInput): Promise<PushSubscriptionRecord> {
    const record = { id: `id-${this.rows.length + 1}`, locale: null, ...input };
    this.rows = [
      ...this.rows.filter((row) => row.endpoint !== input.endpoint),
      record,
    ];
    return record;
  }

  async findForEventChange(eventId: string): Promise<readonly PushTarget[]> {
    this.asked.push(`event:${eventId}`);
    return this.forEvent ?? this.rows;
  }

  async findForParticipant(userId: string): Promise<readonly PushTarget[]> {
    this.asked.push(`participant:${userId}`);
    return this.forParticipant ?? this.rows;
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    this.rows = this.rows.filter((row) => row.endpoint !== endpoint);
  }
}

function device(endpoint: string, locale: string | null = null): PushTarget {
  return {
    id: endpoint,
    endpoint,
    p256dhKey: 'p256dh',
    authKey: 'auth',
    locale,
  };
}

/** Mirrors what the `web-push` library throws for a dead subscription. */
function pushError(statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(`push failed: ${statusCode}`), { statusCode });
}

const registry = (enabled: boolean) =>
  ({
    isEnabled: (key: string) => enabled && key === PUSH_MODULE_KEY,
  }) as unknown as CoreModuleRegistryService;

const configuration = (defaultLocale = 'en') =>
  ({
    getLocaleSettings: async () => ({
      defaultLocale,
      activeLocales: ['en', defaultLocale],
    }),
  }) as unknown as ConfigurationService;

const catalogues = () =>
  ({
    resolve: async (locale: string) => ({
      locale,
      catalogue: catalogueFor(locale),
      etag: '"x"',
    }),
  }) as unknown as CatalogueService;

const notice = {
  eventId: 'event-1',
  name: 'Spring Assembly',
  path: '/series/spring/events/assembly',
  changes: ['time'] as const,
  period: {
    startsAt: '2026-10-01T16:00:00.000Z',
    endsAt: '2026-10-01T18:00:00.000Z',
    timezone: 'Europe/Berlin',
  },
  place: 'Bürgerhaus Kalk',
};

const payloadOf = (call: number) =>
  JSON.parse(mockedWebPush.sendNotification.mock.calls[call][1] as string);

/** Every endpoint the library was handed, in no particular order. */
const endpointsCalled = () =>
  mockedWebPush.sendNotification.mock.calls
    .map((call) => (call[0] as webPush.PushSubscription).endpoint)
    .sort();

describe('PushService', () => {
  let repository: FakeSubscriptionRepository;

  const service = (
    env = pushEnv,
    enabled = true,
    defaultLocale = 'en',
  ): PushService => {
    const push = new PushService(
      env,
      repository,
      registry(enabled),
      configuration(defaultLocale),
      catalogues(),
    );
    push.onApplicationBootstrap();
    return push;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new FakeSubscriptionRepository();
    mockedWebPush.sendNotification.mockResolvedValue({} as webPush.SendResult);
  });

  describe('without a VAPID key pair', () => {
    it('starts up without configuring the push library', () => {
      const push = service(loadEnv({}));

      expect(push.isConfigured()).toBe(false);
      expect(mockedWebPush.setVapidDetails).not.toHaveBeenCalled();
    });

    it('refuses to subscribe instead of silently accepting', async () => {
      await expect(
        service(loadEnv({})).subscribe({
          endpoint: 'https://push.example.org/a',
          p256dhKey: 'p',
          authKey: 'a',
          userAgent: null,
          userId: null,
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('still allows unsubscribing, so a stale row can always be cleared', async () => {
      repository.rows = [device('https://push.example.org/a')];

      await service(loadEnv({})).unsubscribe('https://push.example.org/a');

      expect(repository.rows).toEqual([]);
    });

    it('notifies nobody, and does not fail the change that triggered it', async () => {
      repository.rows = [device('https://push.example.org/a')];

      const report = await service(loadEnv({})).notifyEventChange(notice);

      expect(report).toEqual({ delivered: 0, failed: 0, expired: 0 });
      // Not even asked for: an audience is a query, and there is nothing to
      // send it.
      expect(repository.asked).toEqual([]);
    });
  });

  describe('with the push module switched off (E21)', () => {
    it('sends nothing, although the subscriptions are still there (F63)', async () => {
      repository.rows = [device('https://push.example.org/a')];

      const report = await service(pushEnv, false).notifyEventChange(notice);

      expect(report).toEqual({ delivered: 0, failed: 0, expired: 0 });
      expect(mockedWebPush.sendNotification).not.toHaveBeenCalled();
      expect(repository.rows).toHaveLength(1);
    });

    it('sends no personal notification either', async () => {
      repository.rows = [device('https://push.example.org/a', 'en')];

      const report = await service(pushEnv, false).notifyParticipant(
        'profile-1',
        { path: '/messages/c1' },
      );

      expect(report).toEqual({ delivered: 0, failed: 0, expired: 0 });
    });
  });

  describe('with a VAPID key pair', () => {
    let push: PushService;

    beforeEach(() => {
      push = service();
    });

    it('hands the key pair to the push library on startup', () => {
      expect(mockedWebPush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:ngo@example.org',
        'public-key',
        'private-key',
      );
    });

    it('stores a subscription, owner and all', async () => {
      await push.subscribe({
        endpoint: 'https://push.example.org/a',
        p256dhKey: 'p',
        authKey: 'a',
        userAgent: 'Firefox',
        userId: 'profile-1',
      });

      expect(repository.rows).toEqual([
        expect.objectContaining({ userId: 'profile-1' }),
      ]);
    });

    it('asks for the event’s audience and delivers the click target', async () => {
      repository.forEvent = [
        device('https://push.example.org/a', 'en'),
        device('https://push.example.org/b', 'en'),
      ];

      const report = await push.notifyEventChange(notice);

      expect(report).toEqual({ delivered: 2, failed: 0, expired: 0 });
      expect(repository.asked).toEqual(['event:event-1']);
      expect(payloadOf(0).notification).toEqual({
        // The event's own name, not a translated line: it is a proper noun.
        title: 'Spring Assembly',
        body: expect.stringContaining('en:push.event.time'),
        data: { url: '/series/spring/events/assembly' },
      });
    });

    it('writes to each device in the language of its owner (F125)', async () => {
      repository.forEvent = [
        device('https://push.example.org/german', 'de'),
        device('https://push.example.org/english', 'en'),
      ];

      await push.notifyEventChange(notice);

      const bodies = new Map(
        mockedWebPush.sendNotification.mock.calls.map((call, index) => [
          (call[0] as webPush.PushSubscription).endpoint,
          payloadOf(index).notification.body as string,
        ]),
      );
      expect(bodies.get('https://push.example.org/german')).toContain('de:');
      expect(bodies.get('https://push.example.org/english')).toContain('en:');
    });

    it('writes to a device without an account in the instance’s language', async () => {
      push = service(pushEnv, true, 'de');
      repository.forEvent = [device('https://push.example.org/anonymous')];

      await push.notifyEventChange(notice);

      expect(payloadOf(0).notification.body).toContain('de:');
    });

    it('resolves one catalogue per language, not one per device', async () => {
      const resolved: string[] = [];
      push = new PushService(
        pushEnv,
        repository,
        registry(true),
        configuration('en'),
        {
          resolve: async (locale: string) => {
            resolved.push(locale);
            return { locale, catalogue: catalogueFor(locale), etag: '"x"' };
          },
        } as unknown as CatalogueService,
      );
      repository.forEvent = [
        device('https://push.example.org/a', 'de'),
        device('https://push.example.org/b', 'de'),
        device('https://push.example.org/c', 'en'),
      ];

      await push.notifyEventChange(notice);

      expect(resolved.sort()).toEqual(['de', 'en']);
    });

    it('says nothing at all when nothing changed', async () => {
      const report = await push.notifyEventChange({ ...notice, changes: [] });

      expect(report).toEqual({ delivered: 0, failed: 0, expired: 0 });
      expect(repository.asked).toEqual([]);
    });

    it('notifies one participant’s devices and nobody else’s', async () => {
      repository.forParticipant = [
        device('https://push.example.org/phone', 'en'),
        device('https://push.example.org/laptop', 'en'),
      ];

      const report = await push.notifyParticipant('profile-7', {
        path: '/messages/c1',
      });

      expect(report).toEqual({ delivered: 2, failed: 0, expired: 0 });
      expect(repository.asked).toEqual(['participant:profile-7']);
      expect(endpointsCalled()).toEqual([
        'https://push.example.org/laptop',
        'https://push.example.org/phone',
      ]);
    });

    it('says nothing about who wrote or what they said (NFR 7)', async () => {
      repository.forParticipant = [device('https://push.example.org/a', 'en')];

      await push.notifyParticipant('profile-7', { path: '/messages/c1' });

      expect(payloadOf(0).notification).toEqual({
        title: 'en:push.message.title {{period}}{{place}}',
        body: 'en:push.message.body {{period}}{{place}}',
        data: { url: '/messages/c1' },
      });
    });

    it('removes subscriptions the push service reports as gone', async () => {
      repository.rows = [
        device('https://push.example.org/gone', 'en'),
        device('https://push.example.org/ok', 'en'),
      ];
      mockedWebPush.sendNotification.mockImplementation(
        async (target: webPush.PushSubscription) => {
          if (target.endpoint.endsWith('/gone')) throw pushError(410);
          return {} as webPush.SendResult;
        },
      );

      const report = await push.notifyEventChange(notice);

      expect(report).toEqual({ delivered: 1, failed: 0, expired: 1 });
      expect(repository.rows.map((row) => row.endpoint)).toEqual([
        'https://push.example.org/ok',
      ]);
    });

    it('keeps delivering when one endpoint fails for another reason', async () => {
      repository.rows = [
        device('https://push.example.org/broken', 'en'),
        device('https://push.example.org/ok', 'en'),
      ];
      mockedWebPush.sendNotification.mockImplementation(
        async (target: webPush.PushSubscription) => {
          if (target.endpoint.endsWith('/broken')) throw pushError(500);
          return {} as webPush.SendResult;
        },
      );

      const report = await push.notifyEventChange(notice);

      expect(report).toEqual({ delivered: 1, failed: 1, expired: 0 });
      // A transient server error must not discard a valid subscription.
      expect(repository.rows).toHaveLength(2);
    });

    it('sends one notification, not one per device, when nobody subscribed', async () => {
      repository.forEvent = [];

      const report = await push.notifyEventChange(notice);

      expect(report).toEqual({ delivered: 0, failed: 0, expired: 0 });
      expect(mockedWebPush.sendNotification).not.toHaveBeenCalled();
    });
  });
});
