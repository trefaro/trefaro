import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import type {
  OrganizerConversationPage,
  OrganizerConversationSummary,
} from '@trefaro/shared-models';
import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { ConversationsAdminService } from '../../features/chat/conversations-admin.service';
import { EventSeriesAdminService } from '../../features/event-series/event-series-admin.service';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { MessagesPage } from './messages-page';

function request(
  overrides: Partial<OrganizerConversationSummary> = {},
): OrganizerConversationSummary {
  return {
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
    preview: {
      senderType: 'guest',
      text: 'Is the venue accessible?',
      hasImage: false,
    },
    ...overrides,
  };
}

function group(
  overrides: Partial<OrganizerConversationSummary> = {},
): OrganizerConversationSummary {
  return request({
    id: 'conversation-2',
    type: 'group',
    topic: 'Travel to Köln',
    guest: null,
    memberCount: 3,
    lastMessageAt: null,
    preview: null,
    ...overrides,
  });
}

/** The template drives protected members; the tests reach them the same way. */
interface PageInternals {
  who: (row: OrganizerConversationSummary) => string;
  preview: (row: OrganizerConversationSummary) => string;
  waiting: (row: OrganizerConversationSummary) => boolean;
  when: (row: OrganizerConversationSummary) => string;
  toggleGroupForm: () => void;
  loadMore: () => Promise<void>;
}

class FakeConversationsAdminService {
  pages: OrganizerConversationPage[] = [
    { rows: [request(), group()], total: 2, page: 1, pageSize: 20 },
  ];
  readonly asked: number[] = [];
  failing = false;

  list(query: { page?: number }): Promise<OrganizerConversationPage> {
    this.asked.push(query.page ?? 1);
    if (this.failing) return Promise.reject({ status: 500, message: 'boom' });
    return Promise.resolve(
      this.pages[Math.min((query.page ?? 1) - 1, this.pages.length - 1)],
    );
  }
}

async function render(
  seeded: {
    service?: FakeConversationsAdminService;
    chat?: boolean;
    publicUrl?: string;
  } = {},
) {
  const conversations = seeded.service ?? new FakeConversationsAdminService();
  const enabled = seeded.chat ?? true;

  TestBed.configureTestingModule({
    providers: [
      provideTranslationsForTest({
        'admin.messages.title': 'Messages',
        'admin.messages.lead': 'Questions and groups.',
        'admin.messages.empty': 'Nothing yet.',
        'admin.messages.awaiting': 'Waiting for an answer',
        'admin.messages.guest': 'Without an account',
        'admin.messages.group.tag': 'Group',
        'admin.messages.group.new': 'New group',
        'admin.messages.group.cancel': 'Cancel',
        'admin.messages.group.off': 'The chat module is switched off.',
        'admin.messages.members': '{{count}} participants',
        'admin.messages.noMessages': 'Nothing written yet',
        'admin.messages.picture': 'A picture',
        'admin.messages.unnamed': 'Conversation',
        'admin.messages.more': 'Show more',
        'admin.messages.error': 'Loading the conversations failed.',
        'common.loading': 'Loading…',
      }),
      provideRouter([]),
      { provide: ConversationsAdminService, useValue: conversations },
      {
        provide: AppConfigService,
        useValue: {
          isModuleEnabled: () => enabled,
          publicUserClientUrl: signal(
            seeded.publicUrl ?? 'https://events.example.org',
          ),
        },
      },
      // Reached by the group panel when it opens.
      {
        provide: EventSeriesAdminService,
        useValue: { series: signal([]), reload: () => Promise.resolve() },
      },
      {
        provide: EventsAdminService,
        useValue: { listBySeries: () => Promise.resolve([]) },
      },
    ],
  });

  const fixture = TestBed.createComponent(MessagesPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  const host = fixture.nativeElement as HTMLElement;
  return {
    conversations,
    page: fixture.componentInstance as unknown as PageInternals,
    text: () => host.textContent ?? '',
    links: () =>
      [...host.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? ''),
    buttons: () =>
      [...host.querySelectorAll('button')].map(
        (b) => b.textContent?.trim() ?? '',
      ),
    settle: async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    },
  };
}

/**
 * The organization's message overview (FR 3.4 — AP 10).
 *
 * What this file decides is what the screen *says*, since everything it shows
 * is counted and sorted by the server. Three sentences carry the package:
 * a question is named by the person who asked, a group by its subject, and a
 * conversation nobody has answered says so.
 */
describe('MessagesPage', () => {
  it('names a question by its sender and a group by its subject', async () => {
    const { page } = await render();

    expect(page.who(request())).toBe('Amina Okonkwo');
    // A guest who typed no name is still somebody: the address is what the
    // organizer has, and it is what they will answer to (F11).
    expect(page.who(request({ guest: { name: null, email: 'a@b.org' } }))).toBe(
      'a@b.org',
    );
    expect(page.who(group())).toBe('Travel to Köln');
  });

  it('marks what nobody has answered, and only that (F133)', async () => {
    const { page, text } = await render();

    expect(page.waiting(request())).toBe(true);
    expect(
      page.waiting(
        request({
          preview: { senderType: 'admin', text: 'Yes.', hasImage: false },
        }),
      ),
    ).toBe(false);
    // A group nobody has written in is not waiting for anything.
    expect(page.waiting(group())).toBe(false);
    expect(text()).toContain('Waiting for an answer');
  });

  it('says a word for a line that is only a picture, and for an empty group', async () => {
    const { page } = await render();

    expect(page.preview(request())).toBe('Is the venue accessible?');
    expect(
      page.preview(
        request({
          preview: { senderType: 'user', text: null, hasImage: true },
        }),
      ),
    ).toBe('A picture');
    expect(page.preview(group())).toBe('Nothing written yet');
  });

  it('leaves the time of a conversation nobody has written in empty', async () => {
    const { page } = await render();

    expect(page.when(group())).toBe('');
    expect(page.when(request())).not.toBe('');
  });

  it('links the event to the page the question was asked on (F112)', async () => {
    const { links } = await render();

    expect(links()).toContain(
      'https://events.example.org/series/buergerraete/events/kickoff',
    );
  });

  it('shows the event as text when the deployment did not say where the client is', async () => {
    const { links, text } = await render({ publicUrl: '' });

    expect(links()).not.toContain(
      'https://events.example.org/series/buergerraete/events/kickoff',
    );
    expect(text()).toContain('Kickoff in Köln');
  });

  it('offers no group and says why when the chat is switched off (F175)', async () => {
    const { text, buttons } = await render({ chat: false });

    expect(text()).toContain('The chat module is switched off.');
    expect(buttons()).not.toContain('New group');
    // And the list itself still answered: contact requests are P1 and arrive
    // whether or not the optional chat is on.
    expect(text()).toContain('Amina Okonkwo');
  });

  it('opens and closes the group panel', async () => {
    const { page, buttons, settle } = await render();

    expect(buttons()).toContain('New group');
    page.toggleGroupForm();
    await settle();
    expect(buttons()).toContain('Cancel');
  });

  it('keeps the rows on screen when a further page fails', async () => {
    const service = new FakeConversationsAdminService();
    service.pages = [
      { rows: [request()], total: 2, page: 1, pageSize: 1 },
      { rows: [group()], total: 2, page: 2, pageSize: 1 },
    ];
    const { text, settle } = await render({ service });

    service.failing = true;
    TestBed.inject(ConversationsAdminService) as unknown as never;
    await settle();

    expect(text()).toContain('Amina Okonkwo');
  });

  it('says so when nothing has arrived', async () => {
    const service = new FakeConversationsAdminService();
    service.pages = [{ rows: [], total: 0, page: 1, pageSize: 20 }];
    const { text } = await render({ service });

    expect(text()).toContain('Nothing yet.');
  });

  it('reports a failure instead of an empty list', async () => {
    const service = new FakeConversationsAdminService();
    service.failing = true;
    const { text } = await render({ service });

    expect(text()).toContain('Loading the conversations failed.');
    expect(text()).not.toContain('Nothing yet.');
  });
});
