import { ServiceUnavailableException } from '@nestjs/common';
import * as webPush from 'web-push';
import { loadEnv } from '../../core/config/env';
import type {
  PushSubscriptionInput,
  PushSubscriptionRecord,
  PushSubscriptionRepository,
} from './ports/push-subscription.repository';
import { PushService } from './push.service';

jest.mock('web-push');

const mockedWebPush = jest.mocked(webPush);

const pushEnv = loadEnv({
  VAPID_PUBLIC_KEY: 'public-key',
  VAPID_PRIVATE_KEY: 'private-key',
  VAPID_SUBJECT: 'mailto:ngo@example.org',
});

class FakeSubscriptionRepository implements PushSubscriptionRepository {
  rows: PushSubscriptionRecord[] = [];

  async save(input: PushSubscriptionInput): Promise<PushSubscriptionRecord> {
    const record = { id: `id-${this.rows.length + 1}`, ...input };
    this.rows = [
      ...this.rows.filter((row) => row.endpoint !== input.endpoint),
      record,
    ];
    return record;
  }

  async findAll(): Promise<readonly PushSubscriptionRecord[]> {
    return this.rows;
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    this.rows = this.rows.filter((row) => row.endpoint !== endpoint);
  }
}

function subscription(endpoint: string): PushSubscriptionRecord {
  return { id: endpoint, endpoint, p256dhKey: 'p256dh', authKey: 'auth' };
}

/** Mirrors what the `web-push` library throws for a dead subscription. */
function pushError(statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(`push failed: ${statusCode}`), { statusCode });
}

describe('PushService', () => {
  let repository: FakeSubscriptionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new FakeSubscriptionRepository();
  });

  describe('without a VAPID key pair', () => {
    const service = () => new PushService(loadEnv({}), repository);

    it('starts up without configuring the push library', () => {
      const push = service();
      push.onApplicationBootstrap();

      expect(push.isConfigured()).toBe(false);
      expect(mockedWebPush.setVapidDetails).not.toHaveBeenCalled();
    });

    it('refuses to subscribe instead of silently accepting', async () => {
      await expect(
        service().subscribe({
          endpoint: 'https://push.example.org/a',
          p256dhKey: 'p',
          authKey: 'a',
          userAgent: null,
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('still allows unsubscribing, so a stale row can always be cleared', async () => {
      repository.rows = [subscription('https://push.example.org/a')];

      await service().unsubscribe('https://push.example.org/a');

      expect(repository.rows).toEqual([]);
    });
  });

  describe('with a VAPID key pair', () => {
    let push: PushService;

    beforeEach(() => {
      push = new PushService(pushEnv, repository);
      push.onApplicationBootstrap();
    });

    it('hands the key pair to the push library on startup', () => {
      expect(mockedWebPush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:ngo@example.org',
        'public-key',
        'private-key',
      );
    });

    it('stores a subscription', async () => {
      await push.subscribe({
        endpoint: 'https://push.example.org/a',
        p256dhKey: 'p',
        authKey: 'a',
        userAgent: 'Firefox',
      });

      expect(repository.rows).toHaveLength(1);
    });

    it('delivers to every subscription and sends the click target along', async () => {
      repository.rows = [
        subscription('https://push.example.org/a'),
        subscription('https://push.example.org/b'),
      ];
      mockedWebPush.sendNotification.mockResolvedValue(
        {} as webPush.SendResult,
      );

      const report = await push.broadcast({
        title: 'Programme changed',
        body: 'The opening keynote moved to 10:00.',
        url: '/events/42',
      });

      expect(report).toEqual({ delivered: 2, failed: 0, expired: 0 });
      const [, payload] = mockedWebPush.sendNotification.mock.calls[0];
      expect(JSON.parse(payload as string)).toEqual({
        notification: {
          title: 'Programme changed',
          body: 'The opening keynote moved to 10:00.',
          data: { url: '/events/42' },
        },
      });
    });

    it('removes subscriptions the push service reports as gone', async () => {
      repository.rows = [
        subscription('https://push.example.org/gone'),
        subscription('https://push.example.org/ok'),
      ];
      mockedWebPush.sendNotification.mockImplementation(
        async (target: webPush.PushSubscription) => {
          if (target.endpoint.endsWith('/gone')) throw pushError(410);
          return {} as webPush.SendResult;
        },
      );

      const report = await push.broadcast({ title: 'T', body: 'B' });

      expect(report).toEqual({ delivered: 1, failed: 0, expired: 1 });
      expect(repository.rows.map((row) => row.endpoint)).toEqual([
        'https://push.example.org/ok',
      ]);
    });

    it('keeps delivering when one endpoint fails for another reason', async () => {
      repository.rows = [
        subscription('https://push.example.org/broken'),
        subscription('https://push.example.org/ok'),
      ];
      mockedWebPush.sendNotification.mockImplementation(
        async (target: webPush.PushSubscription) => {
          if (target.endpoint.endsWith('/broken')) throw pushError(500);
          return {} as webPush.SendResult;
        },
      );

      const report = await push.broadcast({ title: 'T', body: 'B' });

      expect(report).toEqual({ delivered: 1, failed: 1, expired: 0 });
      // A transient server error must not discard a valid subscription.
      expect(repository.rows).toHaveLength(2);
    });

    it('omits the data payload when no click target is given', async () => {
      repository.rows = [subscription('https://push.example.org/a')];
      mockedWebPush.sendNotification.mockResolvedValue(
        {} as webPush.SendResult,
      );

      await push.broadcast({ title: 'T', body: 'B' });

      const [, payload] = mockedWebPush.sendNotification.mock.calls[0];
      expect(JSON.parse(payload as string).notification.data).toBeUndefined();
    });
  });
});
