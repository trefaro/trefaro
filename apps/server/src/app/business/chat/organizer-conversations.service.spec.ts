import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { OrganizerEvent, PublicEvent } from '@trefaro/shared-models';
import { MAX_MESSAGE_LENGTH, awaitsAnswer } from '@trefaro/shared-models';
import type {
  ImageBytes,
  ImageFileService,
} from '../common/image-file.service';
import type { EventLocation, EventsService } from '../events';
import { MailDeliveryError, MailService } from '../mail';
import type { ContactAnswerMailContext, MailContent } from '../mail';
import { PublicLinks } from '../mail';
import type { TrefaroEnv } from '../../core/config/env';
import type { ChatNotificationsService } from './chat-notifications.service';
import { ChatRealtimeService } from './chat-realtime.service';
import { OrganizerConversationsService } from './organizer-conversations.service';
import type {
  AppendedMessage,
  MessageImageRecord,
  MessageRecord,
  MessageRepository,
  NewMessage,
} from './ports/message.repository';
import type {
  GroupCandidateRecord,
  NewGroup,
  OrganizerConversationRecord,
  OrganizerConversationRepository,
  OrganizerConversationSlice,
} from './ports/organizer-conversation.repository';
import type { ConversationCounterpartRecord } from './ports/conversation.repository';

const ENV = {
  publicUserClientUrl: 'https://events.example.org/',
  publicAdminClientUrl: 'https://admin.events.example.org',
  smtp: { from: 'Example NGO <office@example.org>' },
} as TrefaroEnv;

const EVENT = {
  id: 'event-1',
  slug: 'kickoff',
  name: 'Kickoff in Köln',
  description: 'The opening weekend.',
  logoUrl: null,
  eventType: 'onsite',
  startsAt: '2099-03-28T08:00:00.000Z',
  endsAt: '2099-03-28T15:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  venueAddress: null,
  onlineUrl: null,
  languages: ['de'],
  followUpBody: null,
} satisfies PublicEvent;

const REQUEST: OrganizerConversationRecord = {
  id: 'conversation-1',
  type: 'organizer_contact',
  eventId: 'event-1',
  topic: null,
  guestEmail: 'amina@example.org',
  guestName: 'Amina Okonkwo',
  lastMessageAt: new Date('2026-09-03T09:00:00.000Z'),
  memberCount: 0,
  preview: {
    senderType: 'guest',
    text: 'Is the venue accessible?',
    hasImage: false,
  },
};

const GROUP: OrganizerConversationRecord = {
  id: 'conversation-2',
  type: 'group',
  eventId: 'event-1',
  topic: 'Travel to Köln',
  guestEmail: null,
  guestName: null,
  lastMessageAt: null,
  memberCount: 3,
  preview: null,
};

const MEMBERS: readonly ConversationCounterpartRecord[] = [
  {
    id: 'profile-1',
    firstName: 'Amina',
    lastName: 'Okonkwo',
    avatarPath: null,
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  },
];

const CANDIDATES: readonly GroupCandidateRecord[] = [
  {
    profileId: 'profile-1',
    firstName: 'Amina',
    lastName: 'Okonkwo',
    email: 'amina@example.org',
  },
  {
    profileId: 'profile-2',
    firstName: 'Bo',
    lastName: 'Lindgren',
    email: 'bo@example.org',
  },
];

class FakeOrganizerConversationRepository implements OrganizerConversationRepository {
  rows: OrganizerConversationRecord[] = [REQUEST, GROUP];
  members: readonly ConversationCounterpartRecord[] = MEMBERS;
  candidates: readonly GroupCandidateRecord[] = CANDIDATES;
  /** Set when the requested people are not all eligible (E39). */
  refuseGroup = false;
  readonly groups: NewGroup[] = [];
  readonly listed: { offset: number; limit: number }[] = [];

  async list(
    offset: number,
    limit: number,
  ): Promise<OrganizerConversationSlice> {
    this.listed.push({ offset, limit });
    return {
      rows: this.rows.slice(offset, offset + limit),
      total: this.rows.length,
    };
  }

  async find(id: string): Promise<OrganizerConversationRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async membersOf(): Promise<readonly ConversationCounterpartRecord[]> {
    return this.members;
  }

  async groupCandidatesOf(): Promise<readonly GroupCandidateRecord[]> {
    return this.candidates;
  }

  async createGroup(
    group: NewGroup,
  ): Promise<OrganizerConversationRecord | null> {
    if (this.refuseGroup) return null;
    this.groups.push(group);
    const created: OrganizerConversationRecord = {
      ...GROUP,
      id: `conversation-${this.rows.length + 1}`,
      topic: group.topic,
      eventId: group.eventId,
      memberCount: group.profileIds.length,
    };
    this.rows.push(created);
    return created;
  }
}

class FakeMessageRepository implements MessageRepository {
  readonly appended: NewMessage[] = [];
  rows: MessageRecord[] = [];
  image: MessageImageRecord | null = null;

  async append(message: NewMessage): Promise<AppendedMessage> {
    this.appended.push(message);
    const record: MessageRecord = {
      id: `message-${this.appended.length}`,
      conversationId: message.conversationId,
      senderType: message.senderType,
      senderId: message.senderId,
      body: message.body,
      hasImage: message.image !== null,
      createdAt: new Date('2026-09-03T10:00:00.000Z'),
    };
    this.rows = [record, ...this.rows];
    return {
      record,
      // What the write really finds: a group has its members, a contact
      // request has none at all — the organization's side is not a
      // membership row (F133).
      members:
        message.conversationId === GROUP.id
          ? [{ memberType: 'user', memberId: 'profile-1' }]
          : [],
    };
  }

  async history(
    conversationId: string,
    before: string | null,
    limit: number,
  ): Promise<readonly MessageRecord[]> {
    const rows = this.rows.filter(
      (row) => row.conversationId === conversationId,
    );
    const from = before ? rows.findIndex((row) => row.id === before) + 1 : 0;
    return rows.slice(from, from + limit);
  }

  async findImage(): Promise<MessageImageRecord | null> {
    return this.image;
  }
}

/** Events by id, with their series' address — what `locate` answers (F49). */
class FakeEventsService {
  missing = false;
  readonly locales: (string | undefined)[] = [];
  readonly askedMany: readonly string[][] = [];

  async getForOrganizer(id: string): Promise<OrganizerEvent> {
    if (this.missing) throw new NotFoundException(`No event with id "${id}"`);
    return {
      ...EVENT,
      seriesId: 'series-1',
      status: 'published',
      createdAt: '',
      updatedAt: '',
    };
  }

  async locate(id: string, locale?: string): Promise<EventLocation> {
    this.locales.push(locale);
    return {
      event: locale === 'en' ? { ...EVENT, name: 'Kickoff in Cologne' } : EVENT,
      seriesSlug: 'buergerraete',
    };
  }

  async locateMany(
    ids: readonly string[],
  ): Promise<ReadonlyMap<string, EventLocation>> {
    (this.askedMany as string[][]).push([...ids]);
    const located = new Map<string, EventLocation>();
    for (const id of ids) {
      located.set(id, { event: EVENT, seriesSlug: 'buergerraete' });
    }
    return located;
  }
}

/** Plays `MailService`'s part in resolving the content (F125). */
class RecordingMailService {
  readonly sent: { to: string; context: ContactAnswerMailContext }[] = [];
  failing = false;
  locale = 'de';

  async sendContactAnswer(
    to: string,
    content: MailContent<ContactAnswerMailContext>,
  ): Promise<void> {
    if (this.failing) throw new MailDeliveryError(new Error('ECONNREFUSED'));
    this.sent.push({
      to,
      context:
        typeof content === 'function'
          ? await (
              content as (locale: string) => Promise<ContactAnswerMailContext>
            )(this.locale)
          : content,
    });
  }
}

class FakeImageFileService {
  bytes: ImageBytes | null = {
    bytes: Buffer.from('PNG'),
    mimeType: 'image/png',
  };
  readonly read_: { area: string; path: string | null }[] = [];

  async read(area: string, path: string | null): Promise<ImageBytes | null> {
    this.read_.push({ area, path });
    return this.bytes;
  }
}

/** Records what was delivered, without a socket (E41). */
class RecordingRealtime {
  readonly published: { id: string; members: number }[] = [];

  publishMessage(
    message: { conversationId: string },
    members: readonly unknown[],
  ): void {
    this.published.push({
      id: message.conversationId,
      members: members.length,
    });
  }
}

/** The other half of delivering an answer: whoever is not watching (E44). */
class RecordingNotifications {
  readonly notified: { id: string; members: number }[] = [];

  async notifyAbsent(
    message: { conversationId: string },
    members: readonly unknown[],
  ): Promise<void> {
    this.notified.push({
      id: message.conversationId,
      members: members.length,
    });
  }
}

/**
 * The organization's side of the conversations (FR 3.4 — AP 10).
 *
 * What this file decides, as opposed to the contract suite: the rules that
 * hold whatever the database does. Four of them matter most —
 *
 * 1. an id that is not the organization's is **one** 404 (F173);
 * 2. an answer to a guest is **stored first**, and the mail's fate travels
 *    back in the answer rather than as an error (F174);
 * 3. a group answers `none`, because its members read it in the app;
 * 4. a group whose people are not all eligible creates **nothing** (E39).
 */
describe('OrganizerConversationsService', () => {
  let conversations: FakeOrganizerConversationRepository;
  let messages: FakeMessageRepository;
  let events: FakeEventsService;
  let mail: RecordingMailService;
  let images: FakeImageFileService;
  let realtime: RecordingRealtime;
  let notifications: RecordingNotifications;
  let service: OrganizerConversationsService;

  beforeEach(() => {
    conversations = new FakeOrganizerConversationRepository();
    messages = new FakeMessageRepository();
    events = new FakeEventsService();
    mail = new RecordingMailService();
    images = new FakeImageFileService();
    realtime = new RecordingRealtime();
    notifications = new RecordingNotifications();
    service = new OrganizerConversationsService(
      conversations,
      messages,
      events as unknown as EventsService,
      mail as unknown as MailService,
      new PublicLinks(ENV),
      images as unknown as ImageFileService,
      realtime as unknown as ChatRealtimeService,
      notifications as unknown as ChatNotificationsService,
    );
  });

  describe('the overview', () => {
    it('names the event of every row in one read (F49)', async () => {
      const page = await service.list({});

      expect(page.total).toBe(2);
      expect(page.rows.map((row) => row.event?.name)).toEqual([
        'Kickoff in Köln',
        'Kickoff in Köln',
      ]);
      // One lookup for the whole page, with the id asked for once.
      expect(events.askedMany).toEqual([['event-1']]);
    });

    it('carries the guest of a request and the subject of a group', async () => {
      const [request, group] = (await service.list({})).rows;

      expect(request.guest).toEqual({
        name: 'Amina Okonkwo',
        email: 'amina@example.org',
      });
      expect(request.topic).toBeNull();
      expect(group.guest).toBeNull();
      expect(group.topic).toBe('Travel to Köln');
      expect(group.memberCount).toBe(3);
    });

    it('says which conversation is waiting for an answer, and which is not', async () => {
      const [request, group] = (await service.list({})).rows;

      // Somebody else wrote last, so nobody here has answered.
      expect(awaitsAnswer(request)).toBe(true);
      // A group nobody has written in is not waiting for anything.
      expect(awaitsAnswer(group)).toBe(false);
    });

    it('caps the window the way every other list does', async () => {
      await service.list({ pageSize: 5000 });

      expect(conversations.listed[0].limit).toBeLessThanOrEqual(50);
    });
  });

  describe('one conversation', () => {
    it('adds the names of the accounts in it', async () => {
      const group = await service.get('conversation-2');

      expect(group.members).toEqual([
        { profileId: 'profile-1', name: 'Amina Okonkwo', avatarUrl: null },
      ]);
    });

    it('answers 404 for an id that is not the organization’s (F173)', async () => {
      await expect(service.get('conversation-9')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses the history of such an id as well', async () => {
      await expect(service.history('conversation-9', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('answering', () => {
    it('stores the line as the organizer who wrote it (E39)', async () => {
      await service.reply('admin-1', 'conversation-1', {
        body: '  Yes, it is.  ',
      });

      expect(messages.appended).toEqual([
        {
          conversationId: 'conversation-1',
          senderType: 'admin',
          senderId: 'admin-1',
          body: 'Yes, it is.',
          image: null,
        },
      ]);
    });

    it('sends the answer to the person who asked, and says so (F11, F174)', async () => {
      const reply = await service.reply('admin-1', 'conversation-1', {
        body: 'Yes.\n\nSee you there.',
      });

      expect(reply.delivery).toBe('sent');
      expect(mail.sent[0].to).toBe('amina@example.org');
      expect(mail.sent[0].context.guestName).toBe('Amina Okonkwo');
      // The same split the invitation preview uses, so the mail and the
      // organizer's screen cut the text the same way.
      expect(mail.sent[0].context.paragraphs).toEqual([
        'Yes.',
        'See you there.',
      ]);
      expect(mail.sent[0].context.event.url).toBe(
        'https://events.example.org/series/buergerraete/events/kickoff',
      );
    });

    it('fetches the event inside the callback, in the letter’s language (F125)', async () => {
      mail.locale = 'en';

      const reply = await service.reply('admin-1', 'conversation-1', {
        body: 'Yes.',
      });

      expect(reply.delivery).toBe('sent');
      expect(events.locales).toEqual(['en']);
      expect(mail.sent[0].context.event.name).toBe('Kickoff in Cologne');
    });

    it('keeps the line and reports the failure when the mail cannot go (F174)', async () => {
      mail.failing = true;

      const reply = await service.reply('admin-1', 'conversation-1', {
        body: 'Yes.',
      });

      // Stored either way — the record is the conversation. The organizer is
      // told, which is the opposite of the notification in AP 9 (F172), and
      // for the opposite reason: there a difference must not be visible, here
      // it must.
      expect(reply.delivery).toBe('failed');
      expect(messages.appended).toHaveLength(1);
      expect(reply.message.body).toBe('Yes.');
    });

    it('sends nothing for a group, and delivers it over the socket', async () => {
      const reply = await service.reply('admin-1', 'conversation-2', {
        body: 'The bus leaves at eight.',
      });

      expect(reply.delivery).toBe('none');
      expect(mail.sent).toEqual([]);
      // The members came back with the write (F163), so delivery reaches the
      // people who were in it when the line was written.
      expect(realtime.published).toEqual([
        { id: 'conversation-2', members: 1 },
      ]);
    });

    it('notifies the members of a group who are not watching it (E44)', async () => {
      await service.reply('admin-1', 'conversation-2', {
        body: 'The bus leaves at eight.',
      });

      // The same line and the same members the socket got: an answer from the
      // organization reaches a group the way any other message does, and who
      // is actually absent is the notifier's own question.
      expect(notifications.notified).toEqual([
        { id: 'conversation-2', members: 1 },
      ]);
    });

    it('notifies nobody about an answer to a guest, who has no membership (F133)', async () => {
      await service.reply('admin-1', 'conversation-1', { body: 'Yes, it is.' });

      // Asked all the same, and it finds nobody: the write returns no members
      // for a contact request, so the mail is the whole delivery. A branch
      // here would be a second place that knows what F133 already says.
      expect(notifications.notified).toEqual([
        { id: 'conversation-1', members: 0 },
      ]);
    });

    it('refuses an empty answer and one past the limit', async () => {
      await expect(
        service.reply('admin-1', 'conversation-1', { body: '   ' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.reply('admin-1', 'conversation-1', {
          body: 'x'.repeat(MAX_MESSAGE_LENGTH + 1),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(messages.appended).toEqual([]);
    });

    it('refuses an id that is not the organization’s, writing nothing', async () => {
      await expect(
        service.reply('admin-1', 'conversation-9', { body: 'Hello?' }),
      ).rejects.toThrow(NotFoundException);
      expect(messages.appended).toEqual([]);
    });
  });

  describe('assembling a group (E39)', () => {
    it('creates it with the people that were picked', async () => {
      const group = await service.createGroup({
        eventId: 'event-1',
        topic: '  Travel to Köln  ',
        profileIds: ['profile-1', 'profile-2'],
      });

      expect(conversations.groups).toEqual([
        {
          eventId: 'event-1',
          topic: 'Travel to Köln',
          profileIds: ['profile-1', 'profile-2'],
        },
      ]);
      expect(group.topic).toBe('Travel to Köln');
      expect(group.type).toBe('group');
    });

    it('sends the same id once, however often it was picked', async () => {
      await service.createGroup({
        eventId: 'event-1',
        topic: 'Travel',
        profileIds: ['profile-1', 'profile-1', 'profile-2'],
      });

      expect(conversations.groups[0].profileIds).toEqual([
        'profile-1',
        'profile-2',
      ]);
    });

    it('refuses a group without a subject or without members', async () => {
      await expect(
        service.createGroup({
          eventId: 'event-1',
          topic: '   ',
          profileIds: ['profile-1'],
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createGroup({
          eventId: 'event-1',
          topic: 'Travel',
          profileIds: [],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(conversations.groups).toEqual([]);
    });

    it('refuses an unknown event before it asks anybody', async () => {
      events.missing = true;

      await expect(
        service.createGroup({
          eventId: 'event-9',
          topic: 'Travel',
          profileIds: ['profile-1'],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(conversations.groups).toEqual([]);
    });

    it('says so when somebody picked has no confirmed place (E39)', async () => {
      conversations.refuseGroup = true;

      await expect(
        service.createGroup({
          eventId: 'event-1',
          topic: 'Travel',
          profileIds: ['profile-1', 'profile-3'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lists the candidates with their addresses (E13)', async () => {
      const people = await service.candidates('event-1');

      expect(people).toEqual([
        {
          profileId: 'profile-1',
          name: 'Amina Okonkwo',
          email: 'amina@example.org',
        },
        {
          profileId: 'profile-2',
          name: 'Bo Lindgren',
          email: 'bo@example.org',
        },
      ]);
    });

    it('answers 404 for candidates of an unknown event', async () => {
      events.missing = true;

      await expect(service.candidates('event-9')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('a picture in a conversation', () => {
    it('serves it from the messages area', async () => {
      messages.image = {
        conversationId: 'conversation-2',
        path: 'messages/aa/one',
      };

      const image = await service.readImage('conversation-2', 'message-1');

      expect(image.mimeType).toBe('image/png');
      expect(images.read_).toEqual([
        { area: 'messages', path: 'messages/aa/one' },
      ]);
    });

    it('refuses a picture that belongs to another conversation', async () => {
      messages.image = {
        conversationId: 'conversation-1',
        path: 'messages/aa/one',
      };

      await expect(
        service.readImage('conversation-2', 'message-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses a message without a picture, and one in nobody’s conversation', async () => {
      messages.image = null;
      await expect(
        service.readImage('conversation-2', 'message-1'),
      ).rejects.toThrow(NotFoundException);

      messages.image = {
        conversationId: 'conversation-9',
        path: 'messages/aa/one',
      };
      await expect(
        service.readImage('conversation-9', 'message-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses bytes the volume no longer holds', async () => {
      messages.image = {
        conversationId: 'conversation-2',
        path: 'messages/aa/one',
      };
      images.bytes = null;

      await expect(
        service.readImage('conversation-2', 'message-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
