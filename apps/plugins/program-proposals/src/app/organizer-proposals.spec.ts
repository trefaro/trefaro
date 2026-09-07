import { TestBed } from '@angular/core/testing';
import type {
  ProgramProposal,
  ProposalPage,
  ProposalSummary,
} from '@trefaro/shared-models';
import { OrganizerProposals } from './organizer-proposals';
import { ProposalsApi } from './proposals-api';

/** What the host hands over under `plugins.programProposals.`, prefix stripped. */
const STRINGS: Record<string, string> = {
  title: 'Programmvorschläge',
  moderation: 'Vorschläge zum Entscheiden',
  approvalNote: 'Eine Freigabe veröffentlicht den Vorschlag.',
  queueEmpty: 'Es wartet nichts auf eine Entscheidung.',
  approve: 'Freigeben',
  reject: 'Ablehnen',
  proposedBy: 'Vorgeschlagen von',
  unknownAuthor: 'Konto gelöscht',
  statusPending: 'Ausstehend',
  statusApproved: 'Freigegeben',
  statusRejected: 'Abgelehnt',
  loading: 'Wird geladen …',
  error: 'Das hat nicht funktioniert.',
  more: 'Mehr anzeigen',
};

function proposal(over: Partial<ProgramProposal> = {}): ProgramProposal {
  return {
    id: 'proposal-1',
    eventId: 'event-1',
    title: 'A workshop on election observation',
    description: 'Half a day, hands on.',
    status: 'pending',
    author: { id: 'author-1', name: 'Amina Okonkwo', avatarUrl: null },
    createdAt: '2026-09-07T09:00:00.000Z',
    decidedAt: null,
    ...over,
  };
}

class FakeApi {
  queue: ProposalPage[] = [{ rows: [], total: 0, page: 1, pageSize: 20 }];
  counts: ProposalSummary = { pending: 0, approved: 0, rejected: 0 };
  approvals: string[] = [];
  rejections: string[] = [];
  reads = 0;
  failDecision = false;

  summary(): Promise<ProposalSummary> {
    return Promise.resolve(this.counts);
  }

  listQueue(_eventId: string, page: number): Promise<ProposalPage> {
    this.reads += 1;
    return Promise.resolve(
      this.queue[Math.min(page - 1, this.queue.length - 1)],
    );
  }

  approve(proposalId: string): Promise<ProgramProposal> {
    this.approvals.push(proposalId);
    if (this.failDecision) return Promise.reject(new Error('boom'));
    return Promise.resolve(proposal({ id: proposalId, status: 'approved' }));
  }

  reject(proposalId: string): Promise<ProgramProposal> {
    this.rejections.push(proposalId);
    return Promise.resolve(proposal({ id: proposalId, status: 'rejected' }));
  }
}

/**
 * The organizer's half of the plug-in (FR 3.14, E59).
 *
 * The section the plug-in draws on the event dashboard: the three counts, the
 * queue, and two buttons per row. What these tests hold on to is that the
 * numbers are the plug-in's own, that a decision is one click, and that the
 * section reads itself again afterwards rather than editing its own numbers.
 */
/**
 * Lets the fetches this section starts finish, then redraws.
 *
 * A macrotask tick rather than `whenStable()`: without zone.js a fixture is
 * "stable" as soon as no change detection is pending, which says nothing about
 * two promises still in flight — and this section reads its counts and its
 * queue in parallel. One `setTimeout(0)` drains the microtask queue whatever
 * the chain looks like.
 */
async function settle(fixture: { detectChanges(): void }): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

describe('OrganizerProposals', () => {
  let api: FakeApi;

  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: ProposalsApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(OrganizerProposals);
    fixture.componentRef.setInput('strings', STRINGS);
    fixture.componentRef.setInput('locale', 'de');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await settle(fixture);
    return fixture;
  }

  const text = (fixture: Awaited<ReturnType<typeof render>>): string =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  const buttons = (
    fixture: Awaited<ReturnType<typeof render>>,
    label: string,
  ): HTMLButtonElement[] =>
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

  it('says what an approval does and does not do (E52)', async () => {
    const fixture = await render({ eventId: 'event-1' });

    // Without this sentence an organizer would reasonably expect an approved
    // proposal to turn up in the programme.
    expect(text(fixture)).toContain(STRINGS['approvalNote']);
  });

  it('says when nothing is waiting, rather than drawing an empty list', async () => {
    const fixture = await render({ eventId: 'event-1' });

    expect(text(fixture)).toContain(STRINGS['queueEmpty']);
    expect(buttons(fixture, 'Freigeben')).toHaveLength(0);
  });

  it('gives every waiting proposal two buttons and nothing else', async () => {
    api.queue = [
      {
        rows: [proposal(), proposal({ id: 'proposal-2' })],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    ];

    const fixture = await render({ eventId: 'event-1' });

    expect(buttons(fixture, 'Freigeben')).toHaveLength(2);
    expect(buttons(fixture, 'Ablehnen')).toHaveLength(2);
    expect(text(fixture)).toContain('Vorgeschlagen von Amina Okonkwo');
  });

  it('approves one and reads the section again afterwards', async () => {
    api.queue = [{ rows: [proposal()], total: 1, page: 1, pageSize: 20 }];
    api.counts = { pending: 1, approved: 0, rejected: 0 };
    const fixture = await render({ eventId: 'event-1' });
    const readsBefore = api.reads;

    api.queue = [{ rows: [], total: 0, page: 1, pageSize: 20 }];
    api.counts = { pending: 0, approved: 1, rejected: 0 };
    buttons(fixture, 'Freigeben')[0].click();
    await settle(fixture);

    expect(api.approvals).toEqual(['proposal-1']);
    // Read again rather than edited in place: a decision changes the queue and
    // all three counts, and a number that drifted from the database would be
    // worse than a moment's wait.
    expect(api.reads).toBe(readsBefore + 1);
    expect(text(fixture)).toContain(STRINGS['queueEmpty']);
  });

  it('rejects one through its own route (E51)', async () => {
    api.queue = [{ rows: [proposal()], total: 1, page: 1, pageSize: 20 }];
    const fixture = await render({ eventId: 'event-1' });

    buttons(fixture, 'Ablehnen')[0].click();
    await settle(fixture);

    expect(api.rejections).toEqual(['proposal-1']);
    expect(api.approvals).toEqual([]);
  });

  it('says so when a decision did not go through', async () => {
    api.queue = [{ rows: [proposal()], total: 1, page: 1, pageSize: 20 }];
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
      {
        rows: [proposal({ id: 'first', title: 'First' })],
        total: 2,
        page: 1,
        pageSize: 20,
      },
      {
        rows: [proposal({ id: 'second', title: 'Second' })],
        total: 2,
        page: 2,
        pageSize: 20,
      },
    ];
    const fixture = await render({ eventId: 'event-1' });

    (
      (fixture.nativeElement as HTMLElement).querySelector(
        '.more',
      ) as HTMLButtonElement
    ).click();
    await settle(fixture);

    const titles = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.row__title'),
    ).map((node) => node.textContent);
    expect(titles).toEqual(['First', 'Second']);
  });

  it('waits for the event id rather than asking about nothing', async () => {
    await render();

    expect(api.reads).toBe(0);
  });
});
