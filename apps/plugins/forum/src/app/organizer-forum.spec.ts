import { TestBed } from '@angular/core/testing';
import type {
  ForumModerationPage,
  ForumSummary,
  ModeratedForumPost,
} from '@trefaro/shared-models';
import { ForumApi } from './forum-api';
import { OrganizerForum } from './organizer-forum';

/** What the host hands over under `plugins.forum.`, prefix stripped. */
const STRINGS: Record<string, string> = {
  title: 'Diskussionsforum',
  moderation: 'Beiträge zum Entscheiden',
  approvalNote: 'Eine Freigabe veröffentlicht den Beitrag.',
  queueEmpty: 'Es wartet nichts auf eine Entscheidung.',
  approve: 'Freigeben',
  reject: 'Ablehnen',
  inThread: 'Im Thema',
  writtenBy: 'Geschrieben von',
  unknownAuthor: 'Konto gelöscht',
  statusPending: 'Ausstehend',
  statusApproved: 'Freigegeben',
  statusRejected: 'Abgelehnt',
  loading: 'Wird geladen …',
  error: 'Das hat nicht funktioniert.',
  more: 'Mehr anzeigen',
};

function moderated(over: Partial<ModeratedForumPost> = {}): ModeratedForumPost {
  return {
    id: 'post-1',
    threadId: 'thread-1',
    body: 'In front of the main entrance?',
    status: 'pending',
    author: { id: 'author-1', name: 'Amina Okonkwo', avatarUrl: null },
    createdAt: '2026-09-08T09:00:00.000Z',
    decidedAt: null,
    thread: { id: 'thread-1', title: 'Where to meet' },
    ...over,
  };
}

function page(
  rows: readonly ModeratedForumPost[],
  over: Partial<ForumModerationPage> = {},
): ForumModerationPage {
  return { rows, total: rows.length, page: 1, pageSize: 20, ...over };
}

class FakeApi {
  queue: ForumModerationPage[] = [page([])];
  counts: ForumSummary = { pending: 0, approved: 0, rejected: 0 };
  approvals: string[] = [];
  rejections: string[] = [];
  reads = 0;
  failDecision = false;

  summary(): Promise<ForumSummary> {
    return Promise.resolve(this.counts);
  }

  listQueue(
    _eventId: string,
    pageNumber: number,
  ): Promise<ForumModerationPage> {
    this.reads += 1;
    return Promise.resolve(
      this.queue[Math.min(pageNumber - 1, this.queue.length - 1)],
    );
  }

  approve(postId: string): Promise<ModeratedForumPost> {
    this.approvals.push(postId);
    if (this.failDecision) return Promise.reject(new Error('boom'));
    return Promise.resolve(moderated({ id: postId, status: 'approved' }));
  }

  reject(postId: string): Promise<ModeratedForumPost> {
    this.rejections.push(postId);
    return Promise.resolve(moderated({ id: postId, status: 'rejected' }));
  }
}

/**
 * Lets the fetches this section starts finish, then redraws.
 *
 * A macrotask tick rather than `whenStable()`: without zone.js a fixture is
 * "stable" as soon as no change detection is pending, which says nothing about
 * two promises still in flight — and this section reads its counts and its
 * queue in parallel.
 */
async function settle(fixture: { detectChanges(): void }): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

/**
 * The organizer's half of the plug-in (FR 4.6, E59).
 *
 * The section the plug-in draws on the event dashboard: the three counts, the
 * queue with each post in the context of its thread, and two buttons per row.
 * What these tests hold on to is that the numbers are the plug-in's own, that
 * a decision is one click on one post (E51), and that the section reads itself
 * again afterwards rather than editing its own numbers.
 */
describe('OrganizerForum', () => {
  let api: FakeApi;

  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: ForumApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(OrganizerForum);
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

  const text = (fixture: Fixture): string =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  const buttons = (fixture: Fixture, label: string): HTMLButtonElement[] =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).filter((button) => button.textContent?.trim() === label);

  beforeEach(() => {
    api = new FakeApi();
  });

  it('draws the three counts of this event (E59)', async () => {
    api.counts = { pending: 3, approved: 12, rejected: 1 };

    const fixture = await render({ eventId: 'event-1' });

    // The numbers live in the section, not on the tile above it: a count on the
    // tile would mean the host asking a plug-in a question.
    expect(text(fixture)).toContain('3');
    expect(text(fixture)).toContain('Ausstehend');
    expect(text(fixture)).toContain('12');
    expect(text(fixture)).toContain('Freigegeben');
    expect(text(fixture)).toContain('1');
    expect(text(fixture)).toContain('Abgelehnt');
  });

  it('says what an approval does — to the post and to its thread (F195)', async () => {
    const fixture = await render({ eventId: 'event-1' });

    expect(text(fixture)).toContain(STRINGS['approvalNote']);
  });

  it('says when nothing is waiting, rather than drawing an empty list', async () => {
    const fixture = await render({ eventId: 'event-1' });

    expect(text(fixture)).toContain(STRINGS['queueEmpty']);
    expect(buttons(fixture, 'Freigeben')).toHaveLength(0);
  });

  it('shows every waiting post in the context of its thread, with two buttons', async () => {
    api.queue = [
      page([
        moderated(),
        moderated({
          id: 'post-2',
          body: 'Two seats free on Friday.',
          thread: { id: 'thread-2', title: 'Car sharing from Cologne' },
        }),
      ]),
    ];

    const fixture = await render({ eventId: 'event-1' });

    expect(buttons(fixture, 'Freigeben')).toHaveLength(2);
    expect(buttons(fixture, 'Ablehnen')).toHaveLength(2);
    // A post out of context is a sentence without its question: the thread's
    // title is on the row, because the decision is about the post in it.
    const threads = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.row__thread'),
    ).map((node) => node.textContent?.trim());
    expect(threads).toEqual([
      'Im Thema: Where to meet',
      'Im Thema: Car sharing from Cologne',
    ]);
    expect(text(fixture)).toContain('Geschrieben von Amina Okonkwo');
  });

  it('names an author whose account is gone as gone', async () => {
    api.queue = [page([moderated({ author: null })])];

    const fixture = await render({ eventId: 'event-1' });

    expect(text(fixture)).toContain('Konto gelöscht');
  });

  it('approves one and reads the section again afterwards', async () => {
    api.queue = [page([moderated()])];
    api.counts = { pending: 1, approved: 0, rejected: 0 };
    const fixture = await render({ eventId: 'event-1' });
    const readsBefore = api.reads;

    api.queue = [page([])];
    api.counts = { pending: 0, approved: 1, rejected: 0 };
    buttons(fixture, 'Freigeben')[0].click();
    await settle(fixture);

    expect(api.approvals).toEqual(['post-1']);
    // Read again rather than edited in place: a decision changes the queue and
    // all three counts, and a number that drifted from the database would be
    // worse than a moment's wait.
    expect(api.reads).toBe(readsBefore + 1);
    expect(text(fixture)).toContain(STRINGS['queueEmpty']);
  });

  it('rejects one through its own route (E51)', async () => {
    api.queue = [page([moderated()])];
    const fixture = await render({ eventId: 'event-1' });

    buttons(fixture, 'Ablehnen')[0].click();
    await settle(fixture);

    expect(api.rejections).toEqual(['post-1']);
    expect(api.approvals).toEqual([]);
  });

  it('says so when a decision did not go through', async () => {
    api.queue = [page([moderated()])];
    api.failDecision = true;
    const fixture = await render({ eventId: 'event-1' });

    buttons(fixture, 'Freigeben')[0].click();
    await settle(fixture);

    expect(text(fixture)).toContain(STRINGS['error']);
    // The row is still there: nothing was decided, so nothing may look decided.
    expect(buttons(fixture, 'Freigeben')).toHaveLength(1);
  });

  it('appends the next page of the queue on request', async () => {
    api.queue = [
      page([moderated({ id: 'first', body: 'First' })], { total: 2 }),
      page([moderated({ id: 'second', body: 'Second' })], {
        total: 2,
        page: 2,
      }),
    ];
    const fixture = await render({ eventId: 'event-1' });

    (
      (fixture.nativeElement as HTMLElement).querySelector(
        '.more',
      ) as HTMLButtonElement
    ).click();
    await settle(fixture);

    const bodies = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.row__body'),
    ).map((node) => node.textContent);
    expect(bodies).toEqual(['First', 'Second']);
  });

  it('waits for the event id rather than asking about nothing', async () => {
    await render();

    expect(api.reads).toBe(0);
  });
});
