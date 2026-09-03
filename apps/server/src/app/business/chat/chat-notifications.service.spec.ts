import type { ChatMessage } from '@trefaro/shared-models';
import type { PushService } from '../push';
import { ChatNotificationsService } from './chat-notifications.service';
import type { ChatRealtimeService } from './chat-realtime.service';
import type { ConversationMemberRef } from './ports/conversation.repository';

const ME = 'profile-me';
const OTHER = 'profile-other';
const THIRD = 'profile-third';

const message = (senderId: string | null = ME): ChatMessage => ({
  id: 'm1',
  conversationId: 'c1',
  senderType: senderId === null ? 'guest' : 'user',
  senderId,
  body: 'Is the venue accessible?',
  imageUrl: null,
  createdAt: '2026-09-03T10:00:00.000Z',
});

const member = (memberId: string): ConversationMemberRef => ({
  memberType: 'user',
  memberId,
});

interface Harness {
  service: ChatNotificationsService;
  notified: { userId: string; path: string }[];
  asked: string[];
}

function harness(
  options: {
    watching?: readonly string[];
    watchersThrow?: boolean;
    pushThrows?: boolean;
  } = {},
): Harness {
  const notified: Harness['notified'] = [];
  const asked: string[] = [];

  const realtime = {
    async watchersOf(conversationId: string) {
      asked.push(conversationId);
      if (options.watchersThrow) throw new Error('the namespace is closed');
      return new Set(options.watching ?? []);
    },
  } as unknown as ChatRealtimeService;

  const push = {
    async notifyParticipant(userId: string, notice: { path: string }) {
      if (options.pushThrows) throw new Error('the push service is down');
      notified.push({ userId, path: notice.path });
      return { delivered: 1, failed: 0, expired: 0 };
    },
  } as unknown as PushService;

  return {
    service: new ChatNotificationsService(realtime, push),
    notified,
    asked,
  };
}

/**
 * E44: a personal notification only goes out when nobody is watching.
 *
 * The three exclusions this service makes are the whole of it, and each of
 * them is a different reason: the sender knows, the organization has no
 * device, and whoever is looking at the conversation has already seen it.
 */
describe('ChatNotificationsService', () => {
  it('notifies the member who is not watching, with the conversation’s path', async () => {
    const { service, notified, asked } = harness();

    await service.notifyAbsent(message(), [member(ME), member(OTHER)]);

    expect(asked).toEqual(['c1']);
    expect(notified).toEqual([{ userId: OTHER, path: '/messages/c1' }]);
  });

  it('does not notify the person who wrote it', async () => {
    const { service, notified } = harness();

    await service.notifyAbsent(message(), [member(ME)]);

    expect(notified).toEqual([]);
  });

  it('does not notify a member who has the conversation open', async () => {
    const { service, notified } = harness({ watching: [OTHER] });

    await service.notifyAbsent(message(), [member(ME), member(OTHER)]);

    // The socket already delivered it. A notification about something
    // somebody is reading is the kind people switch off.
    expect(notified).toEqual([]);
  });

  it('notifies the members of a group who are away, and only those', async () => {
    const { service, notified } = harness({ watching: [OTHER] });

    await service.notifyAbsent(message(), [
      member(ME),
      member(OTHER),
      member(THIRD),
    ]);

    expect(notified).toEqual([{ userId: THIRD, path: '/messages/c1' }]);
  });

  it('skips the organization, which has no participant device (E39)', async () => {
    const { service, notified } = harness();

    await service.notifyAbsent(message('admin-1'), [
      { memberType: 'admin', memberId: 'admin-1' },
      member(OTHER),
    ]);

    expect(notified).toEqual([{ userId: OTHER, path: '/messages/c1' }]);
  });

  it('asks nobody when the only member is the sender', async () => {
    const { service, asked } = harness();

    await service.notifyAbsent(message(), [member(ME)]);

    // Not even "who is watching": there is nobody it could matter for.
    expect(asked).toEqual([]);
  });

  it('notifies both members of a guest’s message, since a guest is nobody’s id', async () => {
    const { service, notified } = harness();

    await service.notifyAbsent(message(null), [member(ME), member(OTHER)]);

    expect(notified.map((one) => one.userId).sort()).toEqual(
      [ME, OTHER].sort(),
    );
  });

  it('swallows a failure to ask who is watching', async () => {
    const { service, notified } = harness({ watchersThrow: true });

    await expect(
      service.notifyAbsent(message(), [member(ME), member(OTHER)]),
    ).resolves.toBeUndefined();

    expect(notified).toEqual([]);
  });

  it('swallows a failed delivery: the message is already stored', async () => {
    const { service } = harness({ pushThrows: true });

    await expect(
      service.notifyAbsent(message(), [member(ME), member(OTHER)]),
    ).resolves.toBeUndefined();
  });
});
