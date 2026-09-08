import { TestBed } from '@angular/core/testing';
import type { ProgramProposal, ProposalPage } from '@trefaro/shared-models';
import { ParticipantProposals } from './participant-proposals';
import { NotSignedInError } from '@trefaro/shared-plugin-kit';
import { ProposalsApi } from './proposals-api';

/** What the host hands over under `plugins.programProposals.`, prefix stripped. */
const STRINGS: Record<string, string> = {
  title: 'Programmvorschläge',
  intro: 'Schlagen Sie eine Session vor.',
  signIn: 'Melden Sie sich an, um eine Session vorzuschlagen.',
  formTitle: 'Session vorschlagen',
  titleLabel: 'Titel',
  descriptionLabel: 'Worum würde es gehen?',
  submit: 'Vorschlagen',
  submitted: 'Danke.',
  others: 'Für diese Veranstaltung vorgeschlagen',
  emptyOthers: 'Bisher ist nichts veröffentlicht.',
  pendingNote:
    'Einen ausstehenden Vorschlag sehen nur Sie und die Organisation.',
  statusPending: 'Ausstehend',
  statusApproved: 'Freigegeben',
  statusRejected: 'Abgelehnt',
  proposedBy: 'Vorgeschlagen von',
  unknownAuthor: 'Konto gelöscht',
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
    status: 'approved',
    author: { id: 'author-1', name: 'Amina Okonkwo', avatarUrl: null },
    createdAt: '2026-09-07T09:00:00.000Z',
    decidedAt: null,
    ...over,
  };
}

function page(
  rows: readonly ProgramProposal[],
  over: Partial<ProposalPage> = {},
): ProposalPage {
  return { rows, total: rows.length, page: 1, pageSize: 20, ...over };
}

/** A stub of the plug-in's own endpoints; every test says what they answer. */
class FakeApi {
  answers: ProposalPage[] = [page([])];
  submitted: { title: string; description: string }[] = [];
  listedPages: number[] = [];
  failList: unknown = null;
  failSubmit: unknown = null;

  listForParticipant(
    _eventId: string,
    pageNumber: number,
  ): Promise<ProposalPage> {
    this.listedPages.push(pageNumber);
    if (this.failList) return Promise.reject(this.failList);
    return Promise.resolve(
      this.answers[Math.min(pageNumber - 1, this.answers.length - 1)],
    );
  }

  submit(
    _eventId: string,
    input: { title: string; description: string },
  ): Promise<ProgramProposal> {
    this.submitted.push(input);
    if (this.failSubmit) return Promise.reject(this.failSubmit);
    return Promise.resolve(
      proposal({ id: 'created', title: input.title, status: 'pending' }),
    );
  }
}

/**
 * The participant's half of the plug-in (FR 3.13, E58).
 *
 * What these tests are about is the panel's *states*, because that is where the
 * decisions of this package are: no session is an invitation rather than an
 * error, the status of a row is only shown where it says something, and a
 * submitted proposal appears without the list being fetched again.
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

describe('ParticipantProposals', () => {
  let api: FakeApi;

  async function render(
    inputs: Record<string, unknown> = {},
  ): Promise<ReturnType<typeof TestBed.createComponent<ParticipantProposals>>> {
    TestBed.configureTestingModule({
      providers: [{ provide: ProposalsApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(ParticipantProposals);
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

  /**
   * Fills the form the way a person does.
   *
   * With a change detection pass after the typing, which is not ceremony: the
   * fields are `required`, so an empty form is never submitted at all, and a
   * pass between typing and clicking is what a browser does anyway — without
   * one, Angular's last known value for the binding is still the empty string
   * and it never writes the cleared field back.
   */
  function type(
    fixture: Awaited<ReturnType<typeof render>>,
    title: string,
    description: string,
  ): { title: HTMLInputElement } {
    const root = fixture.nativeElement as HTMLElement;
    const titleField = root.querySelector(
      'input[name="title"]',
    ) as HTMLInputElement;
    const descriptionField = root.querySelector(
      'textarea[name="description"]',
    ) as HTMLTextAreaElement;
    titleField.value = title;
    titleField.dispatchEvent(new Event('input'));
    descriptionField.value = description;
    descriptionField.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    return { title: titleField };
  }

  function clickSubmit(fixture: Awaited<ReturnType<typeof render>>): void {
    (
      (fixture.nativeElement as HTMLElement).querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement
    ).click();
  }

  beforeEach(() => {
    api = new FakeApi();
  });

  it('invites a reader without a session to log in (E58)', async () => {
    api.failList = new NotSignedInError();

    const fixture = await render({ eventId: 'event-1' });

    expect(text(fixture)).toContain(STRINGS['signIn']);
    // Not an error: the element is mounted for everybody on purpose, and a
    // section that reported a problem would look broken rather than closed.
    expect(text(fixture)).not.toContain(STRINGS['error']);
    expect(text(fixture)).not.toContain(STRINGS['formTitle']);
  });

  it('says so when the request failed for any other reason', async () => {
    api.failList = new Error('boom');

    const fixture = await render({ eventId: 'event-1' });

    expect(text(fixture)).toContain(STRINGS['error']);
    expect(text(fixture)).not.toContain(STRINGS['signIn']);
  });

  it('has no text of its own — every word comes from the host (E48)', async () => {
    api.answers = [page([proposal()])];

    const fixture = await render({ eventId: 'event-1' });

    expect(text(fixture)).toContain('Programmvorschläge');
    expect(text(fixture)).toContain('Session vorschlagen');
    expect(text(fixture)).toContain('Vorgeschlagen von Amina Okonkwo');
  });

  it('shows the key when the host has no word for it', async () => {
    const fixture = await render({ eventId: 'event-1', strings: {} });

    // What a missing translation looks like everywhere else — a bundle mounted
    // by a host that predates 1.2.0 says what it is missing.
    expect(text(fixture)).toContain('plugins.programProposals.title');
  });

  it('marks a pending row and leaves an approved one unmarked', async () => {
    api.answers = [
      page([
        proposal({ id: 'mine', status: 'pending', title: 'Still waiting' }),
        proposal({ id: 'theirs', status: 'approved', title: 'Published' }),
      ]),
    ];

    const fixture = await render({ eventId: 'event-1' });

    const chips = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.chip',
    );
    // Exactly one: approved is what a published proposal *is*, and a chip on
    // every row would be one repeated word down the page.
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toContain('Ausstehend');
    // A row that is not approved can only be the reader's own (E51), so the
    // sentence about who sees it belongs here.
    expect(text(fixture)).toContain(STRINGS['pendingNote']);
  });

  it('leaves the note out when nothing of the reader’s is pending', async () => {
    api.answers = [page([proposal({ status: 'approved' })])];

    const fixture = await render({ eventId: 'event-1' });

    expect(text(fixture)).not.toContain(STRINGS['pendingNote']);
  });

  it('names an author whose account is gone as gone, not as anonymous', async () => {
    api.answers = [page([proposal({ author: null })])];

    const fixture = await render({ eventId: 'event-1' });

    expect(text(fixture)).toContain('Konto gelöscht');
  });

  it('puts a submitted proposal at the top without fetching the list again', async () => {
    api.answers = [page([proposal({ id: 'old', title: 'Older' })])];
    const fixture = await render({ eventId: 'event-1' });

    const { title } = type(fixture, 'A workshop on counting', 'Half a day.');
    clickSubmit(fixture);
    await settle(fixture);

    expect(api.submitted).toEqual([
      { title: 'A workshop on counting', description: 'Half a day.' },
    ]);
    const titles = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.row__title'),
    ).map((node) => node.textContent);
    expect(titles).toEqual(['A workshop on counting', 'Older']);
    expect(text(fixture)).toContain(STRINGS['submitted']);
    // One read for the first page, and nothing after the write: a refetch
    // would throw away the pages a reader had already opened.
    expect(api.listedPages).toEqual([1]);
    // The form is empty again, so a second thought is not a second copy.
    expect(title.value).toBe('');
  });

  it('sends the reader to the login when the session expired mid-form', async () => {
    const fixture = await render({ eventId: 'event-1' });
    api.failSubmit = new NotSignedInError();

    type(fixture, 'A workshop on counting', 'Half a day.');
    clickSubmit(fixture);
    await settle(fixture);

    expect(text(fixture)).toContain(STRINGS['signIn']);
  });

  it('offers more only while there is more, and appends it', async () => {
    api.answers = [
      page([proposal({ id: 'first', title: 'First' })], { total: 2 }),
      page([proposal({ id: 'second', title: 'Second' })], {
        total: 2,
        page: 2,
      }),
    ];
    const fixture = await render({ eventId: 'event-1' });

    const more = () =>
      (fixture.nativeElement as HTMLElement).querySelector(
        '.more',
      ) as HTMLButtonElement | null;
    expect(more()).not.toBeNull();

    more()?.click();
    await settle(fixture);

    expect(api.listedPages).toEqual([1, 2]);
    const titles = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.row__title'),
    ).map((node) => node.textContent);
    expect(titles).toEqual(['First', 'Second']);
    expect(more()).toBeNull();
  });

  it('waits for the event id rather than asking about nothing', async () => {
    await render();

    expect(api.listedPages).toEqual([]);
  });
});
