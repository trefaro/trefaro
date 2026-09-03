import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import type {
  ChatMessage,
  MessageHistory,
  OrganizerConversationDetail,
  OrganizerReply,
  ReplyDelivery,
} from '@trefaro/shared-models';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../../features/auth/auth.service';
import { ConversationsAdminService } from '../../features/chat/conversations-admin.service';
import { AdminConversationPage } from './conversation-page';

const REQUEST: OrganizerConversationDetail = {
  id: 'conversation-1',
  type: 'organizer_contact',
  topic: null,
  event: {
    id: 'event-1',
    name: 'Kickoff in Köln',
    slug: 'kickoff',
    seriesSlug: 'buergerraete',
  },
  guest: { name: 'Amina Okonkwo', email: 'amina@example.org' },
  memberCount: 0,
  lastMessageAt: '2026-09-03T09:00:00.000Z',
  preview: { senderType: 'guest', text: 'Is it accessible?', hasImage: false },
  members: [],
};

const GROUP: OrganizerConversationDetail = {
  ...REQUEST,
  id: 'conversation-2',
  type: 'group',
  topic: 'Travel to Köln',
  guest: null,
  memberCount: 2,
  members: [
    { profileId: 'profile-1', name: 'Amina Okonkwo', avatarUrl: null },
    { profileId: 'profile-2', name: 'Bo Lindgren', avatarUrl: null },
  ],
};

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    senderType: 'guest',
    senderId: null,
    body: 'Is it accessible?',
    imageUrl: null,
    createdAt: '2026-09-03T09:00:00.000Z',
    ...overrides,
  };
}

interface PageInternals {
  title: () => string;
  members: () => string;
  typed: (event: Event) => void;
  send: (event: Event) => Promise<void>;
  loadOlder: () => Promise<void>;
}

class FakeConversationsAdminService {
  row: OrganizerConversationDetail | null = REQUEST;
  window: MessageHistory = { rows: [message()], hasMore: false };
  delivery: ReplyDelivery = 'sent';
  missing = false;
  imageFails = false;
  readonly replies: { id: string; body: string }[] = [];
  readonly imagesAsked: string[] = [];

  get(id: string): Promise<OrganizerConversationDetail> {
    if (this.missing) return Promise.reject({ status: 404, message: 'no' });
    return Promise.resolve({
      ...(this.row as OrganizerConversationDetail),
      id,
    });
  }

  history(id: string, query: { before?: string }): Promise<MessageHistory> {
    if (this.missing) return Promise.reject({ status: 404, message: 'no' });
    if (query.before) {
      return Promise.resolve({
        rows: [message({ id: 'message-0', body: 'An older line.' })],
        hasMore: false,
      });
    }
    return Promise.resolve(this.window);
  }

  reply(id: string, body: string): Promise<OrganizerReply> {
    this.replies.push({ id, body });
    return Promise.resolve({
      message: message({
        id: `message-${this.replies.length + 10}`,
        senderType: 'admin',
        senderId: 'admin-1',
        body,
      }),
      delivery: this.delivery,
    });
  }

  image(conversationId: string, messageId: string): Promise<string> {
    this.imagesAsked.push(messageId);
    if (this.imageFails) return Promise.reject({ status: 404, message: 'no' });
    return Promise.resolve(`blob:${messageId}`);
  }
}

async function render(
  seeded: {
    service?: FakeConversationsAdminService;
    adminId?: string;
    id?: string;
  } = {},
) {
  const conversations = seeded.service ?? new FakeConversationsAdminService();

  TestBed.configureTestingModule({
    providers: [
      provideTranslationsForTest({
        'admin.messages.thread.back': 'Back to messages',
        'admin.messages.thread.notFound': 'There is no such conversation.',
        'admin.messages.thread.error': 'Loading the conversation failed.',
        'admin.messages.thread.history': 'Conversation history',
        'admin.messages.thread.older': 'Show older messages',
        'admin.messages.thread.empty': 'Nothing has been written here yet.',
        'admin.messages.thread.you': 'You',
        'admin.messages.thread.us': 'Your organization',
        'admin.messages.thread.participant': 'A participant',
        'admin.messages.thread.guestIs': 'Without an account, at {{email}}',
        'admin.messages.thread.noMembers': 'Nobody in it yet',
        'admin.messages.thread.image': 'Picture in this message',
        'admin.messages.thread.imageLoading': 'Loading the picture…',
        'admin.messages.guest': 'Without an account',
        'admin.messages.unnamed': 'Conversation',
        'admin.messages.reply.label': 'Your answer',
        'admin.messages.reply.send': 'Send answer',
        'admin.messages.reply.sending': 'Sending…',
        'admin.messages.reply.failed': 'The answer could not be saved.',
        'admin.messages.reply.posted': 'Your answer is in the conversation.',
        'admin.messages.reply.hintGuest': 'Goes to {{email}} by e-mail.',
        'admin.messages.reply.hintGroup': 'Everybody in this group reads it.',
        'admin.messages.reply.mailSent': 'Your answer went to {{email}}.',
        'admin.messages.reply.mailFailed':
          'Saved, but the e-mail to {{email}} could not be sent.',
        'common.loading': 'Loading…',
      }),
      provideRouter([]),
      { provide: ConversationsAdminService, useValue: conversations },
      {
        provide: AuthService,
        useValue: {
          admin: signal({
            id: seeded.adminId ?? 'admin-1',
            email: 'office@example.org',
            name: 'Office',
            createdAt: '',
            lastLoginAt: null,
          }),
        },
      },
      {
        provide: AppConfigService,
        useValue: {
          publicUserClientUrl: signal('https://events.example.org'),
          isModuleEnabled: () => true,
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(AdminConversationPage);
  fixture.componentRef.setInput('id', seeded.id ?? 'conversation-1');
  fixture.detectChanges();
  // The row, the history and then a request per picture: microtasks the fake
  // resolves, which `whenStable` does not wait for — it waits for change
  // detection. Turned over by hand, as the participant's own thread spec does.
  await turns();
  fixture.detectChanges();

  const host = fixture.nativeElement as HTMLElement;
  return {
    conversations,
    page: fixture.componentInstance as unknown as PageInternals,
    text: () => host.textContent ?? '',
    images: () =>
      [...host.querySelectorAll('img')].map(
        (img) => img.getAttribute('src') ?? '',
      ),
    type: (value: string) => {
      const field = host.querySelector('textarea') as HTMLTextAreaElement;
      field.value = value;
      field.dispatchEvent(new Event('input'));
    },
    submit: () => {
      const form = host.querySelector('form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));
    },
    settle: async () => {
      await turns();
      fixture.detectChanges();
    },
  };
}

/** Lets the fakes' promise chains run out before anything is asserted. */
async function turns(): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
}

/**
 * One conversation of the organization (FR 3.4 — AP 10).
 *
 * The screen where FR 3.4's promise is kept or broken, so what this file
 * decides is the part a person reads: that an answer to somebody without an
 * account says where it went (F174), that a picture appears although the
 * message's own URL is not for the organization (F133), and that an id which
 * is not the organization's is a sentence rather than an error (F173).
 */
describe('AdminConversationPage', () => {
  it('shows the history oldest first, with the guest’s name on their line', async () => {
    const { text } = await render();

    expect(text()).toContain('Amina Okonkwo');
    expect(text()).toContain('Is it accessible?');
  });

  it('says where an answer to somebody without an account will go', async () => {
    const { text } = await render();

    // Before it is written, not only afterwards: an organizer typing into this
    // field is writing a letter, and the screen has to say so (F11).
    expect(text()).toContain('Goes to amina@example.org by e-mail.');
  });

  it('reports that the answer went out (F11, F174)', async () => {
    const { conversations, type, submit, text, settle } = await render();

    type('Yes, the ground floor is level.');
    await settle();
    submit();
    await settle();

    expect(conversations.replies).toEqual([
      { id: 'conversation-1', body: 'Yes, the ground floor is level.' },
    ]);
    expect(text()).toContain('Your answer went to amina@example.org.');
    // And the line is in the history, without a reload.
    expect(text()).toContain('Yes, the ground floor is level.');
  });

  it('says the answer is stored but did not go when the mail failed (F174)', async () => {
    const service = new FakeConversationsAdminService();
    service.delivery = 'failed';
    const { type, submit, text, settle } = await render({ service });

    type('Yes.');
    await settle();
    submit();
    await settle();

    expect(text()).toContain(
      'Saved, but the e-mail to amina@example.org could not be sent.',
    );
    // The line is there all the same — writing again is the way to try again.
    expect(text()).toContain('Yes.');
  });

  it('says nothing about mail for a group, because there is none', async () => {
    const service = new FakeConversationsAdminService();
    service.row = GROUP;
    service.delivery = 'none';
    const { type, submit, text, settle } = await render({
      service,
      id: 'conversation-2',
    });

    expect(text()).toContain('Everybody in this group reads it.');

    type('The bus leaves at eight.');
    await settle();
    submit();
    await settle();

    expect(text()).toContain('Your answer is in the conversation.');
    expect(text()).not.toContain('e-mail');
  });

  it('names the members of a group and the subject as its title', async () => {
    const service = new FakeConversationsAdminService();
    service.row = GROUP;
    const { page, text } = await render({ service, id: 'conversation-2' });

    expect(page.title()).toBe('Travel to Köln');
    expect(page.members()).toBe('Amina Okonkwo, Bo Lindgren');
    expect(text()).toContain('Bo Lindgren');
  });

  it('tells this organizer’s own lines from a colleague’s', async () => {
    const service = new FakeConversationsAdminService();
    service.window = {
      rows: [
        message({
          id: 'm2',
          senderType: 'admin',
          senderId: 'admin-2',
          body: 'Hers.',
        }),
        message({
          id: 'm1',
          senderType: 'admin',
          senderId: 'admin-1',
          body: 'Mine.',
        }),
      ],
      hasMore: false,
    };
    const { text } = await render({ service, adminId: 'admin-1' });

    expect(text()).toContain('You');
    expect(text()).toContain('Your organization');
  });

  it('fetches a picture with the administrative session (F133)', async () => {
    const service = new FakeConversationsAdminService();
    service.window = {
      rows: [
        message({
          senderType: 'user',
          senderId: 'profile-1',
          body: null,
          imageUrl: '/api/media/messages/message-1/attachment',
        }),
      ],
      hasMore: false,
    };
    const { conversations, images, settle } = await render({ service });
    await settle();

    // Not the URL in the message: that one is served to *members* of a
    // conversation, and the organization is not one.
    expect(conversations.imagesAsked).toEqual(['message-1']);
    expect(images()).toEqual(['blob:message-1']);
  });

  it('leaves the line standing when a picture cannot be fetched', async () => {
    const service = new FakeConversationsAdminService();
    service.imageFails = true;
    service.window = {
      rows: [
        message({
          body: 'Look at this.',
          imageUrl: '/api/media/messages/message-1/attachment',
        }),
      ],
      hasMore: false,
    };
    const { text, images, settle } = await render({ service });
    await settle();

    expect(text()).toContain('Look at this.');
    expect(images()).toEqual([]);
  });

  it('loads older messages behind the oldest line', async () => {
    const service = new FakeConversationsAdminService();
    service.window = { rows: [message()], hasMore: true };
    const { page, text, settle } = await render({ service });

    await page.loadOlder();
    await settle();

    expect(text()).toContain('An older line.');
  });

  it('explains an id that is not the organization’s (F173)', async () => {
    const service = new FakeConversationsAdminService();
    service.missing = true;
    const { text } = await render({ service });

    expect(text()).toContain('There is no such conversation.');
    // Said as a sentence, not as a failure: the same answer an unknown id gets.
    expect(text()).not.toContain('Loading the conversation failed.');
  });

  it('refuses to send an empty answer', async () => {
    const { conversations, type, submit, settle } = await render();

    type('   ');
    await settle();
    submit();
    await settle();

    expect(conversations.replies).toEqual([]);
  });
});
