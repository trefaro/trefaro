import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import { RealtimeClient } from '@trefaro/shared-http';
import {
  TranslationService,
  provideTranslationsForTest,
} from '@trefaro/shared-i18n';
import {
  PROFILE_SEARCH_MODULE_KEY,
  type ChatConversationEvent,
  type ConversationPage,
  type ConversationQuery,
  type ConversationSummary,
} from '@trefaro/shared-models';
import { Subject } from 'rxjs';
import { ChatService } from '../../features/chat/chat.service';
import { MessagesPage } from './messages-page';

function direct(
  id: string,
  name: string,
  unread = 0,
  lastMessageAt: string | null = '2026-06-15T16:40:00.000Z',
): ConversationSummary {
  return {
    id,
    type: 'direct',
    topic: null,
    counterparts: [{ profileId: `p-${id}`, name, avatarUrl: null }],
    lastMessageAt,
    unread,
  };
}

class FakeChat {
  readonly asked: ConversationQuery[] = [];
  /** What the next answer holds, by request number. */
  answers: ConversationPage[] = [];
  fails: unknown = null;

  async list(query: ConversationQuery): Promise<ConversationPage> {
    this.asked.push(query);
    if (this.fails) throw this.fails;
    return (
      this.answers[this.asked.length - 1] ?? {
        rows: [],
        total: 0,
        page: 1,
        pageSize: 20,
      }
    );
  }
}

class FakeRealtime {
  readonly conversations = new Subject<ChatConversationEvent>();
  readonly connected = signal(true);
  readonly isConnected = this.connected;
  readonly status = signal<string>('connected');
}

/**
 * My conversations (FR 4.5, AP 8).
 *
 * The rows themselves are the browser suite's subject. What belongs here are
 * the decisions this screen makes: how a conversation is named, what a move
 * over the socket does to a list that is already on screen, and that a failed
 * further page does not take the first one away.
 */
describe('MessagesPage', () => {
  let chat: FakeChat;
  let realtime: FakeRealtime;

  async function render(
    options: { answers?: ConversationPage[]; searchEnabled?: boolean } = {},
  ) {
    chat = new FakeChat();
    chat.answers = options.answers ?? [];
    realtime = new FakeRealtime();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslationsForTest({
          'chat.title': 'Messages',
          'chat.empty': 'You have no conversations yet.',
          'chat.emptyFind': 'Find participants',
          'chat.more': 'Show more',
          'chat.noMessages': 'No messages yet',
          'chat.unread': '{{count}} unread',
          'chat.live.on': 'New messages arrive by themselves.',
          'chat.live.off': 'No live connection — reload to see new messages.',
        }),
        { provide: ChatService, useValue: chat },
        { provide: RealtimeClient, useValue: realtime },
        {
          provide: AppConfigService,
          useValue: {
            isModuleEnabled: (key: string) =>
              key === PROFILE_SEARCH_MODULE_KEY
                ? (options.searchEnabled ?? true)
                : true,
          },
        },
        {
          provide: TranslationService,
          useValue: {
            locale: signal('en'),
            translate: (key: string) => key,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(MessagesPage);
    fixture.detectChanges();
    // The first page is read in the constructor; two turns of the microtask
    // queue is what the fake needs to answer.
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const page = fixture.componentInstance as unknown as {
      rows: () => readonly ConversationSummary[];
      loadMore: () => Promise<void>;
      name: (row: ConversationSummary) => string;
      initials: (row: ConversationSummary) => string;
    };

    return {
      fixture,
      page,
      host: fixture.nativeElement as HTMLElement,
      text: () => String(fixture.nativeElement.textContent),
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('reads the first page without being asked to', async () => {
    await render();

    expect(chat.asked).toEqual([{ page: 1 }]);
  });

  it('names a one-to-one conversation by who it is with', async () => {
    const { page, text } = await render({
      answers: [
        {
          rows: [direct('c1', 'Amina Okonkwo')],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      ],
    });

    expect(page.name(page.rows()[0])).toBe('Amina Okonkwo');
    expect(page.initials(page.rows()[0])).toBe('AO');
    expect(text()).toContain('Amina Okonkwo');
  });

  it('names a group by its topic', async () => {
    const row: ConversationSummary = {
      ...direct('c2', 'Bo Chen'),
      type: 'group',
      topic: 'Observers, Kyiv 2026',
    };
    const { page } = await render({
      answers: [{ rows: [row], total: 1, page: 1, pageSize: 20 }],
    });

    expect(page.name(page.rows()[0])).toBe('Observers, Kyiv 2026');
  });

  it('shows the unread count, and says what the number means', async () => {
    const { host } = await render({
      answers: [
        {
          rows: [direct('c1', 'Amina Okonkwo', 3)],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      ],
    });

    const badge = host.querySelector('.thread__unread');
    expect(badge?.textContent?.trim()).toBe('3');
    // A bare number is not a label a screen reader can use.
    expect(badge?.getAttribute('aria-label')).toBe('3 unread');
  });

  it('draws no badge for a conversation that is caught up', async () => {
    const { host } = await render({
      answers: [
        {
          rows: [direct('c1', 'Amina Okonkwo', 0)],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      ],
    });

    expect(host.querySelector('.thread__unread')).toBeNull();
  });

  it('says where a conversation begins when there are none', async () => {
    const { text } = await render();

    expect(text()).toContain('You have no conversations yet.');
    // One begins in the participant search (E37) — there is no button here.
    expect(text()).toContain('Find participants');
  });

  it('offers no such link where the search is switched off', async () => {
    const { text } = await render({ searchEnabled: false });

    // The two modules are independent (E42): a chat without a directory is a
    // combination an organization may run, and then nothing points there.
    expect(text()).not.toContain('Find participants');
  });

  it('appends a further page rather than replacing the first', async () => {
    const { page } = await render({
      answers: [
        {
          rows: [direct('c1', 'Amina Okonkwo')],
          total: 2,
          page: 1,
          pageSize: 1,
        },
        { rows: [direct('c2', 'Bo Chen')], total: 2, page: 2, pageSize: 1 },
      ],
    });

    await page.loadMore();

    expect(page.rows().map((row) => row.id)).toEqual(['c1', 'c2']);
  });

  it('keeps the rows on screen when a further page fails', async () => {
    const { page } = await render({
      answers: [
        {
          rows: [direct('c1', 'Amina Okonkwo')],
          total: 2,
          page: 1,
          pageSize: 1,
        },
      ],
    });

    chat.fails = { status: 500, explained: false };
    await page.loadMore();

    expect(page.rows()).toHaveLength(1);
  });

  it('asks again for exactly what is on screen when something moves', async () => {
    const { page, fixture } = await render({
      answers: [
        {
          rows: [direct('c1', 'Amina Okonkwo')],
          total: 2,
          page: 1,
          pageSize: 1,
        },
        { rows: [direct('c2', 'Bo Chen')], total: 2, page: 2, pageSize: 1 },
        {
          // The move: c2 is now on top, and c1 comes with it in one window.
          rows: [direct('c2', 'Bo Chen', 1), direct('c1', 'Amina Okonkwo')],
          total: 2,
          page: 1,
          pageSize: 20,
        },
      ],
    });
    await page.loadMore();

    realtime.conversations.next({ conversationId: 'c2', at: 'now' });
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    // One request, for the window that is shown — the event carries no row on
    // purpose, because unread has to be counted again anyway (F161).
    expect(chat.asked[2]).toEqual({ page: 1, pageSize: 20 });
    expect(page.rows().map((row) => row.id)).toEqual(['c2', 'c1']);
    expect(page.rows()[0].unread).toBe(1);
  });

  it('lists a conversation once when a refresh brings it back', async () => {
    const { page, fixture } = await render({
      answers: [
        {
          rows: [direct('c1', 'Amina Okonkwo')],
          total: 1,
          page: 1,
          pageSize: 20,
        },
        {
          rows: [direct('c1', 'Amina Okonkwo', 2)],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      ],
    });

    realtime.conversations.next({ conversationId: 'c1', at: 'now' });
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(page.rows()).toHaveLength(1);
    expect(page.rows()[0].unread).toBe(2);
  });

  it('says out loud that nothing is arriving when the socket is down', async () => {
    const { fixture, text } = await render();

    realtime.connected.set(false);
    realtime.status.set('disconnected');
    fixture.detectChanges();

    // A chat that lost its connection looks exactly like a chat in which
    // nobody is writing (F110).
    expect(text()).toContain('No live connection');
  });
});
