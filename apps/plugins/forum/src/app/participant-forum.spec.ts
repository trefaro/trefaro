import { TestBed } from '@angular/core/testing';
import type {
  ForumPost,
  ForumPostPage,
  ForumThread,
  ForumThreadPage,
  NewForumPost,
  NewForumThread,
  OpenedForumThread,
} from '@trefaro/shared-models';
import { NotSignedInError } from '@trefaro/shared-plugin-kit';
import { ForumApi } from './forum-api';
import { ParticipantForum } from './participant-forum';

/** What the host hands over under `plugins.forum.`, prefix stripped. */
const STRINGS: Record<string, string> = {
  title: 'Diskussionsforum',
  intro: 'Tauschen Sie sich aus.',
  signIn: 'Melden Sie sich an, um mitzureden.',
  threads: 'Themen',
  emptyThreads: 'Bisher hat niemand ein Thema begonnen.',
  newThread: 'Ein neues Thema beginnen',
  titleLabel: 'Titel',
  bodyLabel: 'Ihr Beitrag',
  open: 'Thema beginnen',
  openedBy: 'Begonnen von',
  lastActivity: 'Letzte Aktivität',
  back: 'Alle Themen',
  writtenBy: 'Geschrieben von',
  replyLabel: 'Ihre Antwort',
  reply: 'Antworten',
  posted: 'Danke. Sichtbar nach der Freigabe.',
  pendingNote: 'Einen ausstehenden Beitrag sehen nur Sie und die Organisation.',
  statusPending: 'Ausstehend',
  statusApproved: 'Freigegeben',
  statusRejected: 'Abgelehnt',
  unknownAuthor: 'Konto gelöscht',
  loading: 'Wird geladen …',
  error: 'Das hat nicht funktioniert.',
  more: 'Mehr anzeigen',
};

function thread(over: Partial<ForumThread> = {}): ForumThread {
  return {
    id: 'thread-1',
    eventId: 'event-1',
    title: 'Where to meet',
    author: { id: 'author-1', name: 'Amina Okonkwo', avatarUrl: null },
    createdAt: '2026-09-08T09:00:00.000Z',
    lastPostAt: '2026-09-08T09:00:00.000Z',
    ...over,
  };
}

function post(over: Partial<ForumPost> = {}): ForumPost {
  return {
    id: 'post-1',
    threadId: 'thread-1',
    body: 'In front of the main entrance?',
    status: 'approved',
    author: { id: 'author-1', name: 'Amina Okonkwo', avatarUrl: null },
    createdAt: '2026-09-08T09:00:00.000Z',
    decidedAt: '2026-09-08T09:30:00.000Z',
    ...over,
  };
}

function threadPage(
  rows: readonly ForumThread[],
  over: Partial<ForumThreadPage> = {},
): ForumThreadPage {
  return { rows, total: rows.length, page: 1, pageSize: 20, ...over };
}

function postPage(
  rows: readonly ForumPost[],
  over: Partial<ForumPostPage> = {},
): ForumPostPage {
  return {
    thread: thread(),
    rows,
    total: rows.length,
    page: 1,
    pageSize: 20,
    ...over,
  };
}

/** A stub of the plug-in's own endpoints; every test says what they answer. */
class FakeApi {
  threadPages: ForumThreadPage[] = [threadPage([])];
  postPages: ForumPostPage[] = [postPage([])];
  opened: NewForumThread[] = [];
  replies: { threadId: string; input: NewForumPost }[] = [];
  listedThreadPages: number[] = [];
  listedPosts: { threadId: string; page: number }[] = [];
  failThreads: unknown = null;
  failPosts: unknown = null;
  failOpen: unknown = null;
  failReply: unknown = null;

  listThreads(_eventId: string, page: number): Promise<ForumThreadPage> {
    this.listedThreadPages.push(page);
    if (this.failThreads) return Promise.reject(this.failThreads);
    return Promise.resolve(
      this.threadPages[Math.min(page - 1, this.threadPages.length - 1)],
    );
  }

  openThread(
    _eventId: string,
    input: NewForumThread,
  ): Promise<OpenedForumThread> {
    this.opened.push(input);
    if (this.failOpen) return Promise.reject(this.failOpen);
    const created = thread({
      id: 'created',
      title: input.title,
      lastPostAt: '2026-09-09T12:00:00.000Z',
    });
    return Promise.resolve({
      thread: created,
      post: post({
        id: 'first',
        threadId: created.id,
        body: input.body,
        status: 'pending',
        decidedAt: null,
      }),
    });
  }

  listPosts(threadId: string, page: number): Promise<ForumPostPage> {
    this.listedPosts.push({ threadId, page });
    if (this.failPosts) return Promise.reject(this.failPosts);
    return Promise.resolve(
      this.postPages[Math.min(page - 1, this.postPages.length - 1)],
    );
  }

  reply(threadId: string, input: NewForumPost): Promise<ForumPost> {
    this.replies.push({ threadId, input });
    if (this.failReply) return Promise.reject(this.failReply);
    return Promise.resolve(
      post({
        id: 'reply',
        threadId,
        body: input.body,
        status: 'pending',
        decidedAt: null,
      }),
    );
  }
}

/**
 * Lets the fetches this panel starts finish, then redraws.
 *
 * A macrotask tick rather than `whenStable()`: without zone.js a fixture is
 * "stable" as soon as no change detection is pending, which says nothing about
 * a promise still in flight. One `setTimeout(0)` drains the microtask queue
 * whatever the chain looks like.
 */
async function settle(fixture: { detectChanges(): void }): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

/**
 * The participant's half of the plug-in (FR 4.6, E58).
 *
 * What these tests are about is the panel's *states* and its two views: no
 * session is an invitation rather than an error, a thread opens inside the
 * panel and the list is still there behind it, the status of a post is only
 * shown where it says something, and what a reader writes appears without the
 * list being fetched again.
 */
describe('ParticipantForum', () => {
  let api: FakeApi;

  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: ForumApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(ParticipantForum);
    fixture.componentRef.setInput('strings', STRINGS);
    fixture.componentRef.setInput('locale', 'de');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await settle(fixture);
    return fixture;
  }

  type Fixture = Awaited<ReturnType<typeof render>>;

  const root = (fixture: Fixture): HTMLElement => fixture.nativeElement;
  const text = (fixture: Fixture): string => root(fixture).textContent ?? '';
  const all = (fixture: Fixture, selector: string): string[] =>
    Array.from(root(fixture).querySelectorAll(selector)).map(
      (node) => node.textContent?.trim() ?? '',
    );
  const button = (fixture: Fixture, label: string): HTMLButtonElement => {
    const found = Array.from(root(fixture).querySelectorAll('button')).find(
      (one) => one.textContent?.trim() === label,
    );
    if (!found) throw new Error(`No button "${label}"`);
    return found;
  };

  /**
   * Types into a field the way a person does — with a change detection pass
   * after it, because the fields are `required` and Angular's last known
   * value for the binding is otherwise still the empty string.
   */
  function type(fixture: Fixture, selector: string, value: string): void {
    const field = root(fixture).querySelector(selector) as
      HTMLInputElement | HTMLTextAreaElement | null;
    if (!field) throw new Error(`No field ${selector}`);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function openFirstThread(fixture: Fixture): Promise<void> {
    (root(fixture).querySelector('.thread') as HTMLButtonElement).click();
    await settle(fixture);
  }

  beforeEach(() => {
    api = new FakeApi();
  });

  it('invites a reader without a session to log in (E58)', async () => {
    api.failThreads = new NotSignedInError();

    const fixture = await render({ eventId: 'event-1' });

    expect(text(fixture)).toContain(STRINGS['signIn']);
    // Not an error: the element is mounted for everybody on purpose, and a
    // section that reported a problem would look broken rather than closed.
    expect(text(fixture)).not.toContain(STRINGS['error']);
    expect(text(fixture)).not.toContain(STRINGS['newThread']);
  });

  it('says so when the request failed for any other reason', async () => {
    api.failThreads = new Error('boom');

    const fixture = await render({ eventId: 'event-1' });

    expect(text(fixture)).toContain(STRINGS['error']);
    expect(text(fixture)).not.toContain(STRINGS['signIn']);
  });

  it('has no text of its own — every word comes from the host (E48)', async () => {
    api.threadPages = [threadPage([thread()])];

    const fixture = await render({ eventId: 'event-1' });

    expect(text(fixture)).toContain('Diskussionsforum');
    expect(text(fixture)).toContain('Ein neues Thema beginnen');
    expect(text(fixture)).toContain('Begonnen von Amina Okonkwo');
  });

  it('shows the key when the host has no word for it', async () => {
    const fixture = await render({ eventId: 'event-1', strings: {} });

    // What a missing translation looks like everywhere else — a bundle mounted
    // by a host that predates 1.2.0 says what it is missing.
    expect(text(fixture)).toContain('plugins.forum.title');
  });

  it('says when nobody has started a thread, rather than drawing an empty list', async () => {
    const fixture = await render({ eventId: 'event-1' });

    expect(text(fixture)).toContain(STRINGS['emptyThreads']);
  });

  it('lists the threads in the order the server sorted them', async () => {
    api.threadPages = [
      threadPage([
        thread({ id: 'newer', title: 'Car sharing from Cologne' }),
        thread({ id: 'older', title: 'Where to meet' }),
      ]),
    ];

    const fixture = await render({ eventId: 'event-1' });

    // As sorted by the server — by the latest published post (F195) — and not
    // re-sorted here by something the panel cannot know.
    expect(all(fixture, '.thread__title')).toEqual([
      'Car sharing from Cologne',
      'Where to meet',
    ]);
    expect(text(fixture)).not.toContain(STRINGS['emptyThreads']);
  });

  it('opens a thread inside the panel, with its posts and a chip only where it says something', async () => {
    api.threadPages = [threadPage([thread()])];
    api.postPages = [
      postPage([
        post({ id: 'theirs', body: 'In front of the main entrance?' }),
        post({
          id: 'mine',
          body: 'I will be there at nine.',
          status: 'pending',
          decidedAt: null,
          author: { id: 'me', name: 'Jonas Weber', avatarUrl: null },
        }),
      ]),
    ];
    const fixture = await render({ eventId: 'event-1' });

    await openFirstThread(fixture);

    expect(api.listedPosts).toEqual([{ threadId: 'thread-1', page: 1 }]);
    expect(text(fixture)).toContain('Where to meet');
    expect(all(fixture, '.post__body')).toEqual([
      'In front of the main entrance?',
      'I will be there at nine.',
    ]);
    expect(text(fixture)).toContain('Geschrieben von Jonas Weber');
    // Exactly one chip: approved is what a published post *is*, and a post
    // that is not approved in this list can only be the reader's own (E51).
    const chips = root(fixture).querySelectorAll('.chip');
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toContain('Ausstehend');
    expect(text(fixture)).toContain(STRINGS['pendingNote']);
    // The list is behind the thread, not gone: no form to start a new one here.
    expect(text(fixture)).not.toContain(STRINGS['newThread']);
  });

  it('leaves the note out when nothing of the reader’s is pending', async () => {
    api.threadPages = [threadPage([thread()])];
    api.postPages = [postPage([post()])];
    const fixture = await render({ eventId: 'event-1' });

    await openFirstThread(fixture);

    expect(text(fixture)).not.toContain(STRINGS['pendingNote']);
  });

  it('goes back to the list it already has, without fetching it again', async () => {
    api.threadPages = [threadPage([thread()])];
    api.postPages = [postPage([post()])];
    const fixture = await render({ eventId: 'event-1' });
    await openFirstThread(fixture);

    button(fixture, 'Alle Themen').click();
    await settle(fixture);

    expect(all(fixture, '.thread__title')).toEqual(['Where to meet']);
    expect(text(fixture)).toContain(STRINGS['newThread']);
    expect(api.listedThreadPages).toEqual([1]);
  });

  it('names an author whose account is gone as gone, not as anonymous', async () => {
    api.threadPages = [threadPage([thread({ author: null })])];

    const fixture = await render({ eventId: 'event-1' });

    expect(text(fixture)).toContain('Konto gelöscht');
  });

  it('starts a thread and lands in it, with the first post pending', async () => {
    api.threadPages = [threadPage([thread({ id: 'old', title: 'Older' })])];
    const fixture = await render({ eventId: 'event-1' });

    type(fixture, 'input[name="title"]', 'Car sharing from Cologne');
    type(fixture, 'textarea[name="body"]', 'Two seats free on Friday.');
    button(fixture, 'Thema beginnen').click();
    await settle(fixture);

    expect(api.opened).toEqual([
      { title: 'Car sharing from Cologne', body: 'Two seats free on Friday.' },
    ]);
    // The screen after "open" is the thread itself, with the one post and its
    // status — both came back from the one request (F49).
    expect(text(fixture)).toContain('Car sharing from Cologne');
    expect(all(fixture, '.post__body')).toEqual(['Two seats free on Friday.']);
    expect(all(fixture, '.chip')).toEqual(['Ausstehend']);
    expect(text(fixture)).toContain(STRINGS['posted']);

    // And the list behind it knows the new thread, at the top, without a
    // second read: a refetch would throw away the pages already open.
    button(fixture, 'Alle Themen').click();
    await settle(fixture);
    expect(all(fixture, '.thread__title')).toEqual([
      'Car sharing from Cologne',
      'Older',
    ]);
    expect(api.listedThreadPages).toEqual([1]);
    // The form is empty again, so a second thought is not a second copy.
    expect(
      (root(fixture).querySelector('input[name="title"]') as HTMLInputElement)
        .value,
    ).toBe('');
  });

  it('replies inside the thread and appends the reply, pending', async () => {
    api.threadPages = [threadPage([thread()])];
    api.postPages = [postPage([post()])];
    const fixture = await render({ eventId: 'event-1' });
    await openFirstThread(fixture);

    type(fixture, 'textarea[name="body"]', 'I will be there at nine.');
    button(fixture, 'Antworten').click();
    await settle(fixture);

    expect(api.replies).toEqual([
      { threadId: 'thread-1', input: { body: 'I will be there at nine.' } },
    ]);
    // Appended, because a conversation reads top-down and the reply is the
    // latest word in it.
    expect(all(fixture, '.post__body')).toEqual([
      'In front of the main entrance?',
      'I will be there at nine.',
    ]);
    expect(all(fixture, '.chip')).toEqual(['Ausstehend']);
    expect(text(fixture)).toContain(STRINGS['posted']);
    expect(api.listedPosts).toHaveLength(1);
    expect(
      (
        root(fixture).querySelector(
          'textarea[name="body"]',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe('');
  });

  it('sends the reader to the login when the session expired mid-form', async () => {
    const fixture = await render({ eventId: 'event-1' });
    api.failOpen = new NotSignedInError();

    type(fixture, 'input[name="title"]', 'Car sharing');
    type(fixture, 'textarea[name="body"]', 'Two seats.');
    button(fixture, 'Thema beginnen').click();
    await settle(fixture);

    expect(text(fixture)).toContain(STRINGS['signIn']);
  });

  it('says so when a thread could not be opened, and stays on the list', async () => {
    api.threadPages = [threadPage([thread()])];
    api.failPosts = new Error('gone');
    const fixture = await render({ eventId: 'event-1' });

    await openFirstThread(fixture);

    expect(text(fixture)).toContain(STRINGS['error']);
    expect(all(fixture, '.thread__title')).toEqual(['Where to meet']);
  });

  it('offers more threads only while there are more, and appends them', async () => {
    api.threadPages = [
      threadPage([thread({ id: 'first', title: 'First' })], { total: 2 }),
      threadPage([thread({ id: 'second', title: 'Second' })], {
        total: 2,
        page: 2,
      }),
    ];
    const fixture = await render({ eventId: 'event-1' });

    const more = () =>
      root(fixture).querySelector('.more') as HTMLButtonElement | null;
    expect(more()).not.toBeNull();

    more()?.click();
    await settle(fixture);

    expect(api.listedThreadPages).toEqual([1, 2]);
    expect(all(fixture, '.thread__title')).toEqual(['First', 'Second']);
    expect(more()).toBeNull();
  });

  it('pages through a long thread the same way', async () => {
    api.threadPages = [threadPage([thread()])];
    api.postPages = [
      postPage([post({ id: 'a', body: 'First' })], { total: 2 }),
      postPage([post({ id: 'b', body: 'Second' })], { total: 2, page: 2 }),
    ];
    const fixture = await render({ eventId: 'event-1' });
    await openFirstThread(fixture);

    (root(fixture).querySelector('.more') as HTMLButtonElement).click();
    await settle(fixture);

    expect(api.listedPosts).toEqual([
      { threadId: 'thread-1', page: 1 },
      { threadId: 'thread-1', page: 2 },
    ]);
    expect(all(fixture, '.post__body')).toEqual(['First', 'Second']);
    expect(root(fixture).querySelector('.more')).toBeNull();
  });

  it('waits for the event id rather than asking about nothing', async () => {
    await render();

    expect(api.listedThreadPages).toEqual([]);
  });
});
