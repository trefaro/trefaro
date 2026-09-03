import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Problem } from '@trefaro/shared-http';
import { RealtimeClient } from '@trefaro/shared-http';
import {
  TranslationService,
  provideTranslationsForTest,
} from '@trefaro/shared-i18n';
import {
  MAX_MESSAGE_IMAGE_BYTES,
  type ChatMessage,
  type ConversationSummary,
  type MessageHistory,
  type MessageHistoryQuery,
  type ParticipantAccount,
} from '@trefaro/shared-models';
import { Subject } from 'rxjs';
import { ParticipantSessionService } from '../../features/auth/participant-session.service';
import {
  ChatService,
  type OutgoingMessage,
} from '../../features/chat/chat.service';
import { ConversationPage } from './conversation-page';

const ME = 'me-profile';

const account: ParticipantAccount = {
  id: ME,
  email: 'me@example.org',
  firstName: 'Rea',
  lastName: 'Reader',
  preferredLocale: 'en',
  avatarUrl: null,
  activityAreas: null,
  customFields: {},
  searchable: true,
  confirmedAt: '2026-06-01T10:00:00.000Z',
};

function message(
  id: string,
  options: {
    senderId?: string | null;
    body?: string | null;
    imageUrl?: string | null;
    createdAt?: string;
    senderType?: ChatMessage['senderType'];
  } = {},
): ChatMessage {
  return {
    id,
    conversationId: 'c1',
    senderType: options.senderType ?? 'user',
    senderId: options.senderId === undefined ? 'them' : options.senderId,
    body: options.body ?? `line ${id}`,
    imageUrl: options.imageUrl ?? null,
    createdAt: options.createdAt ?? '2026-06-15T16:40:00.000Z',
  };
}

const summary: ConversationSummary = {
  id: 'c1',
  type: 'direct',
  topic: null,
  counterparts: [{ profileId: 'them', name: 'Amina Okonkwo', avatarUrl: null }],
  lastMessageAt: '2026-06-15T16:40:00.000Z',
  unread: 2,
};

class FakeChat {
  readonly historyAsked: (MessageHistoryQuery & { id: string })[] = [];
  readonly sent: OutgoingMessage[] = [];
  readonly readMarks: string[] = [];
  /** Windows in the order they are asked for. */
  windows: MessageHistory[] = [{ rows: [], hasMore: false }];
  row: ConversationSummary | null = summary;
  historyFails: unknown = null;
  sendFails: unknown = null;
  nextSent: ChatMessage = message('sent-1', { senderId: ME });

  async get(): Promise<ConversationSummary> {
    if (!this.row) throw { status: 404 };
    return this.row;
  }

  async history(
    id: string,
    query: MessageHistoryQuery,
  ): Promise<MessageHistory> {
    this.historyAsked.push({ id, ...query });
    if (this.historyFails) throw this.historyFails;
    return (
      this.windows[this.historyAsked.length - 1] ?? { rows: [], hasMore: false }
    );
  }

  async send(id: string, outgoing: OutgoingMessage): Promise<ChatMessage> {
    if (this.sendFails) throw this.sendFails;
    this.sent.push(outgoing);
    return this.nextSent;
  }

  async markRead(id: string): Promise<void> {
    this.readMarks.push(id);
  }
}

class FakeRealtime {
  readonly messages = new Subject<ChatMessage>();
  readonly left: string[] = [];
  readonly joined: string[] = [];
  readonly connected = signal(true);
  readonly isConnected = this.connected;
  readonly status = signal<string>('connected');
  admits = true;

  async join(id: string): Promise<boolean> {
    this.joined.push(id);
    return this.admits;
  }

  leave(id: string): void {
    this.left.push(id);
  }
}

/** A change event from a file input carrying one file, built by hand. */
function chooseEvent(file: File): Event {
  const input = document.createElement('input');
  input.type = 'file';
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  const event = new Event('change');
  Object.defineProperty(event, 'target', { value: input, configurable: true });
  return event;
}

function png(size = 8, type = 'image/png'): File {
  return new File([new Uint8Array(size)], 'photo.png', { type });
}

interface Internals {
  lines: () => readonly {
    message: ChatMessage;
    mine: boolean;
    day: string | null;
  }[];
  title: () => string;
  senderName: (message: ChatMessage) => string;
  older: () => Promise<void>;
  send: () => Promise<void>;
  choose: (event: Event) => void;
  discard: () => void;
  picture: () => { file: File } | null;
  canSend: () => boolean;
  error: () => Problem | null;
  notFound: () => boolean;
  form: { patchValue: (value: { body: string }) => void };
}

/**
 * One conversation (FR 4.5, AP 8).
 *
 * The subject here is everything the screen decides on its own: the order of
 * the window, whose line is whose, that a sent message is drawn once although
 * it arrives twice, and that looking at a conversation is what marks it read.
 */
describe('ConversationPage', () => {
  let chat: FakeChat;
  let realtime: FakeRealtime;

  async function render(
    options: {
      windows?: MessageHistory[];
      row?: ConversationSummary | null;
      historyFails?: unknown;
      admits?: boolean;
    } = {},
  ) {
    chat = new FakeChat();
    if (options.windows) chat.windows = options.windows;
    if (options.row !== undefined) chat.row = options.row;
    chat.historyFails = options.historyFails ?? null;
    realtime = new FakeRealtime();
    realtime.admits = options.admits ?? true;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslationsForTest({
          'chat.thread.you': 'You',
          'chat.thread.other': 'The other side',
          'chat.thread.organizer': 'The organizers',
          'chat.thread.title': 'Conversation',
          'chat.thread.empty': 'Nothing has been written yet.',
          'chat.thread.notFound': 'This conversation is not available.',
          'chat.thread.older': 'Show earlier messages',
          'chat.compose.send': 'Send',
          'chat.compose.types': '{{types}}, up to {{size}}.',
          'chat.compose.tooLarge': 'That picture is {{size}}. {{hint}}',
          'chat.compose.wrongType': 'This file cannot be sent. {{hint}}',
          'chat.live.notFollowing': 'This conversation is not updating live',
        }),
        { provide: ChatService, useValue: chat },
        { provide: RealtimeClient, useValue: realtime },
        {
          provide: ParticipantSessionService,
          useValue: { participant: signal(account) },
        },
        {
          provide: TranslationService,
          useValue: {
            locale: signal('en'),
            // Non-reactive, exactly like the real one (F72).
            translate: (key: string) => key,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ConversationPage);
    fixture.componentRef.setInput('id', 'c1');
    fixture.detectChanges();
    // History, then the row, then the join, then the read mark — four turns.
    for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
    fixture.detectChanges();

    return {
      fixture,
      page: fixture.componentInstance as unknown as Internals,
      host: fixture.nativeElement as HTMLElement,
      text: () => String(fixture.nativeElement.textContent),
      settle: async () => {
        for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
        fixture.detectChanges();
      },
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('turns the window around: oldest at the top', async () => {
    const { page } = await render({
      windows: [
        {
          // As the endpoint answers it — newest first, because that is the end
          // a cursor pages backwards from (F154).
          rows: [
            message('m3', { createdAt: '2026-06-15T16:42:00.000Z' }),
            message('m2', { createdAt: '2026-06-15T16:41:00.000Z' }),
            message('m1', { createdAt: '2026-06-15T16:40:00.000Z' }),
          ],
          hasMore: true,
        },
      ],
    });

    expect(page.lines().map((line) => line.message.id)).toEqual([
      'm1',
      'm2',
      'm3',
    ]);
  });

  it('tells its own lines from the other side’s by the sender id', async () => {
    const { page } = await render({
      windows: [
        {
          rows: [
            message('m2', { senderId: ME }),
            message('m1', { senderId: 'them' }),
          ],
          hasMore: false,
        },
      ],
    });

    expect(page.lines().map((line) => line.mine)).toEqual([false, true]);
  });

  it('names the other side from the conversation, not from the message', async () => {
    const { page, text } = await render({
      windows: [
        { rows: [message('m1', { senderId: 'them' })], hasMore: false },
      ],
    });

    expect(page.title()).toBe('Amina Okonkwo');
    expect(page.senderName(message('m1', { senderId: 'them' }))).toBe(
      'Amina Okonkwo',
    );
    expect(text()).toContain('Amina Okonkwo');
  });

  it('names the organizer as a side rather than as a person', async () => {
    const { page } = await render();

    // An organizer has no profile a participant may open (E39), so there is no
    // name to resolve — only which side wrote.
    expect(
      page.senderName(message('m1', { senderType: 'admin', senderId: null })),
    ).toBe('chat.thread.organizer');
  });

  it('shows the lines even when the conversation’s own row cannot be read', async () => {
    const { page } = await render({
      row: null,
      windows: [{ rows: [message('m1')], hasMore: false }],
    });

    // A name is worth less than the conversation (F146 in miniature).
    expect(page.lines()).toHaveLength(1);
    expect(page.title()).toBe('chat.thread.title');
  });

  it('joins the room and marks the conversation as read on opening', async () => {
    await render();

    expect(realtime.joined).toEqual(['c1']);
    expect(chat.readMarks).toEqual(['c1']);
  });

  it('takes a line that arrives while it is open, and marks it read', async () => {
    const { page, settle } = await render();

    realtime.messages.next(message('m9', { senderId: 'them' }));
    await settle();

    expect(page.lines().map((line) => line.message.id)).toEqual(['m9']);
    expect(chat.readMarks).toEqual(['c1', 'c1']);
  });

  it('ignores a line from another conversation', async () => {
    const { page, settle } = await render();

    realtime.messages.next({
      ...message('m9'),
      conversationId: 'somewhere-else',
    });
    await settle();

    expect(page.lines()).toHaveLength(0);
  });

  it('draws a message it sent once, although it arrives twice', async () => {
    const { page, settle } = await render();
    chat.nextSent = message('sent-1', { senderId: ME });

    page.form.patchValue({ body: 'Hello there' });
    await page.send();
    await settle();
    // The socket delivers the same line to every member, sender included.
    realtime.messages.next(chat.nextSent);
    await settle();

    expect(page.lines().map((line) => line.message.id)).toEqual(['sent-1']);
    // And it is not a message this reader has to be told they read.
    expect(chat.readMarks).toEqual(['c1']);
  });

  it('empties the box after sending, and sends what was typed', async () => {
    const { page } = await render();

    page.form.patchValue({ body: '  Hello there  ' });
    expect(page.canSend()).toBe(true);
    await page.send();

    expect(chat.sent).toEqual([{ body: 'Hello there', image: null }]);
    expect(page.canSend()).toBe(false);
  });

  it('sends nothing at all for an empty box', async () => {
    const { page } = await render();

    page.form.patchValue({ body: '   ' });
    await page.send();

    // Neither text nor picture is not a message (E40), and the button says so
    // before the server has to.
    expect(page.canSend()).toBe(false);
    expect(chat.sent).toHaveLength(0);
  });

  it('sends a picture alone', async () => {
    const { page, fixture } = await render();

    page.choose(chooseEvent(png()));
    fixture.detectChanges();
    expect(page.canSend()).toBe(true);
    await page.send();

    expect(chat.sent[0].image?.name).toBe('photo.png');
    expect(page.picture()).toBeNull();
  });

  it('refuses a picture that is too heavy, before it is uploaded', async () => {
    const { page } = await render();

    page.choose(chooseEvent(png(MAX_MESSAGE_IMAGE_BYTES + 1)));

    expect(page.error()?.key).toBe('chat.compose.tooLarge');
    expect(page.picture()).toBeNull();
    expect(page.canSend()).toBe(false);
  });

  it('refuses a file that is not one of the picture types', async () => {
    const { page } = await render();

    page.choose(chooseEvent(png(8, 'application/pdf')));

    expect(page.error()?.key).toBe('chat.compose.wrongType');
    expect(page.picture()).toBeNull();
  });

  it('asks for older messages with the id of the oldest line', async () => {
    const { page } = await render({
      windows: [
        { rows: [message('m5'), message('m4')], hasMore: true },
        { rows: [message('m3'), message('m2')], hasMore: false },
      ],
    });

    await page.older();

    expect(chat.historyAsked[1]).toEqual({ id: 'c1', before: 'm4' });
    expect(page.lines().map((line) => line.message.id)).toEqual([
      'm2',
      'm3',
      'm4',
      'm5',
    ]);
  });

  it('says a conversation that is not this account’s is not available', async () => {
    const { page, text, host } = await render({
      historyFails: { status: 404 },
    });

    expect(page.notFound()).toBe(true);
    expect(text()).toContain('This conversation is not available.');
    // And no box to write in one that cannot be read.
    expect(host.querySelector('textarea')).toBeNull();
  });

  it('says out loud when a refused join left the history standing still', async () => {
    const { text } = await render({ admits: false });

    expect(text()).toContain('This conversation is not updating live');
  });

  it('leaves the room when the screen goes away', async () => {
    const { fixture } = await render();

    fixture.destroy();

    expect(realtime.left).toEqual(['c1']);
  });

  it('draws one day heading for lines of the same day', async () => {
    const { page } = await render({
      windows: [
        {
          rows: [
            message('m3', { createdAt: '2026-06-16T09:00:00.000Z' }),
            message('m2', { createdAt: '2026-06-15T16:41:00.000Z' }),
            message('m1', { createdAt: '2026-06-15T16:40:00.000Z' }),
          ],
          hasMore: false,
        },
      ],
    });

    const days = page.lines().map((line) => line.day);
    expect(days[0]).not.toBeNull();
    expect(days[1]).toBeNull();
    expect(days[2]).not.toBeNull();
  });
});
