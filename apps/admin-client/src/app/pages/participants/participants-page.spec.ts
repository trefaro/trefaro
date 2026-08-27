import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type {
  OrganizerEvent,
  ParticipantDetail,
  ParticipantPage as ParticipantPageModel,
  ParticipantQuery,
  ParticipantRow,
  ParticipantSort,
  RegistrationStatistics,
  RegistrationStatus,
} from '@trefaro/shared-models';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { ParticipantsAdminService } from '../../features/registrations/participants-admin.service';
import { ParticipantsPage } from './participants-page';

const EVENT: OrganizerEvent = {
  id: 'event-1',
  seriesId: 'series-1',
  slug: 'kickoff',
  name: 'Kickoff in Köln',
  description: 'The opening weekend.',
  logoUrl: null,
  eventType: 'onsite',
  startsAt: '2099-03-28T08:00:00.000Z',
  endsAt: '2099-03-28T15:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: null,
  venueAddress: null,
  onlineUrl: null,
  languages: ['de'],
  status: 'published',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
};

function row(overrides: Partial<ParticipantRow> = {}): ParticipantRow {
  return {
    id: 'registration-1',
    firstName: 'Amina',
    lastName: 'Okonkwo',
    email: 'amina@example.org',
    phone: null,
    origin: 'Cologne',
    status: 'pending',
    newsletterOptIn: false,
    contactOptOut: false,
    registeredAt: '2026-08-24T09:30:00.000Z',
    confirmedAt: null,
    ...overrides,
  };
}

const PAGE: ParticipantPageModel = {
  rows: [row()],
  total: 1,
  page: 1,
  pageSize: 25,
  counts: { total: 3, pending: 1, confirmed: 1, cancelled: 1 },
};

const STATISTICS: RegistrationStatistics = {
  weeks: [
    { weekStart: '2026-08-10', total: 2, confirmed: 1 },
    { weekStart: '2026-08-17', total: 8, confirmed: 6 },
    { weekStart: '2026-08-24', total: 4, confirmed: 4 },
  ],
  counts: PAGE.counts,
  timezone: 'Europe/Berlin',
};

class FakeParticipantsAdminService {
  readonly queries: { eventId: string; query: ParticipantQuery }[] = [];
  readonly statusChanges: { id: string; status: RegistrationStatus }[] = [];
  readonly removed: string[] = [];
  page: ParticipantPageModel = PAGE;
  detail: ParticipantDetail | null = null;

  list(
    eventId: string,
    query: ParticipantQuery,
  ): Promise<ParticipantPageModel> {
    this.queries.push({ eventId, query });
    return Promise.resolve(this.page);
  }

  statistics(): Promise<RegistrationStatistics> {
    return Promise.resolve(STATISTICS);
  }

  get(): Promise<ParticipantDetail> {
    return this.detail
      ? Promise.resolve(this.detail)
      : Promise.reject({ status: 404, message: 'gone', retryable: false });
  }

  setStatus(id: string, status: RegistrationStatus): Promise<ParticipantRow> {
    this.statusChanges.push({ id, status });
    return Promise.resolve(row({ status }));
  }

  remove(id: string): Promise<void> {
    this.removed.push(id);
    return Promise.resolve();
  }
}

/** The template drives protected members; the tests reach them the same way. */
interface PageInternals {
  bars: () => readonly { totalHeight: number; confirmedHeight: number }[];
  chartLabel: () => string;
  pages: () => number;
  matchLabel: () => string;
  when: (iso: string) => string;
  ariaSort: (column: ParticipantSort) => string;
  onSearch: (event: Event) => void;
  sortBy: (column: ParticipantSort) => void;
  goToPage: (page: number) => void;
  cancel: (row: ParticipantRow) => void;
  reinstate: (row: ParticipantRow) => void;
  remove: (row: ParticipantRow) => void;
}

interface Navigation {
  queryParams?: Record<string, unknown>;
}

async function render(params: Partial<Record<string, string>> = {}): Promise<{
  page: PageInternals;
  participants: FakeParticipantsAdminService;
  navigations: Navigation[];
  settle: () => Promise<void>;
}> {
  const participants = new FakeParticipantsAdminService();

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ParticipantsAdminService, useValue: participants },
      {
        provide: EventsAdminService,
        useValue: { get: () => Promise.resolve(EVENT) },
      },
    ],
  });

  const navigations: Navigation[] = [];
  const router = TestBed.inject(Router);
  router.navigate = ((_commands: unknown[], extras?: Navigation) => {
    navigations.push(extras ?? {});
    return Promise.resolve(true);
  }) as Router['navigate'];

  const fixture = TestBed.createComponent(ParticipantsPage);
  fixture.componentRef.setInput('seriesId', 'series-1');
  fixture.componentRef.setInput('eventId', 'event-1');
  for (const [key, value] of Object.entries(params)) {
    fixture.componentRef.setInput(key, value);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return {
    page: fixture.componentInstance as unknown as PageInternals,
    participants,
    navigations,
    settle: async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    },
  };
}

describe('ParticipantsPage', () => {
  beforeEach(() => {
    // jsdom has no dialogs, and every destructive action asks first.
    window.confirm = () => true;
  });

  afterEach(() => TestBed.resetTestingModule());

  it('asks the server for exactly what the URL describes', async () => {
    const { participants } = await render({
      search: '  okonkwo ',
      status: 'confirmed',
      sort: 'name',
      direction: 'asc',
      page: '3',
    });

    expect(participants.queries.at(-1)).toEqual({
      eventId: 'event-1',
      query: {
        search: 'okonkwo',
        status: 'confirmed',
        sort: 'name',
        direction: 'asc',
        page: 3,
      },
    });
  });

  it('falls back to the defaults for a URL somebody edited by hand', async () => {
    const { participants } = await render({
      status: 'archived',
      sort: 'salary',
      direction: 'sideways',
      page: '-2',
    });

    expect(participants.queries.at(-1)?.query).toEqual({
      search: undefined,
      status: undefined,
      sort: 'registeredAt',
      direction: 'desc',
      page: 1,
    });
  });

  it('puts the search into the URL after the typing stops, and starts over at page 1', async () => {
    const { page, navigations } = await render({ page: '4' });

    page.onSearch({ target: { value: ' Okonkwo ' } } as unknown as Event);
    // Nothing yet: a request per keystroke is what the debounce prevents.
    expect(navigations).toHaveLength(0);
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(navigations.at(-1)?.queryParams).toEqual({
      search: 'Okonkwo',
      // Page 4 of the old result says nothing about the new one.
      page: null,
    });
  });

  it('reverses the sort on a second click and resets it on a new column', async () => {
    const { page, navigations } = await render({
      sort: 'name',
      direction: 'asc',
    });

    page.sortBy('name');
    page.sortBy('email');

    expect(navigations[0].queryParams).toEqual({
      sort: 'name',
      direction: 'desc',
      page: null,
    });
    expect(navigations[1].queryParams).toEqual({
      sort: 'email',
      direction: 'asc',
      page: null,
    });
  });

  it('tells assistive technology which column is sorted', async () => {
    const { page } = await render({ sort: 'email', direction: 'desc' });

    expect(page.ariaSort('email')).toBe('descending');
    expect(page.ariaSort('name')).toBe('none');
  });

  it('never asks for a page below the first', async () => {
    const { page, navigations } = await render();

    page.goToPage(0);

    expect(navigations.at(-1)?.queryParams).toEqual({ page: 1 });
  });

  it('reinstates to confirmed only when the participant had confirmed', async () => {
    const { page, participants } = await render();

    page.reinstate(row({ id: 'a', status: 'cancelled', confirmedAt: null }));
    page.reinstate(
      row({
        id: 'b',
        status: 'cancelled',
        confirmedAt: '2026-08-25T08:00:00.000Z',
      }),
    );

    // A confirmation an organizer set by hand would be indistinguishable from a
    // real double opt-in afterwards, so the server refuses it — and the client
    // does not ask for it.
    expect(participants.statusChanges).toEqual([
      { id: 'a', status: 'pending' },
      { id: 'b', status: 'confirmed' },
    ]);
  });

  it('cancels and deletes only after asking', async () => {
    const { page, participants } = await render();
    window.confirm = () => false;

    page.cancel(row({ id: 'a' }));
    page.remove(row({ id: 'a' }));

    expect(participants.statusChanges).toHaveLength(0);
    expect(participants.removed).toHaveLength(0);
  });

  it('reloads the page after a change, so the counts are not stale', async () => {
    const { page, participants, settle } = await render();
    const before = participants.queries.length;

    page.cancel(row({ id: 'registration-1' }));
    await settle();

    expect(participants.queries.length).toBeGreaterThan(before);
  });

  it("shows timestamps in the event's zone, not the reader's", async () => {
    const { page } = await render();

    // 22:30 UTC is half past midnight the next day in Cologne (E8).
    expect(page.when('2026-08-24T22:30:00.000Z')).toContain('25');
  });

  it('scales the graph to its tallest week', async () => {
    const { page } = await render();

    const bars = page.bars();
    expect(bars).toHaveLength(3);
    // The week with eight registrations is the full height of the chart.
    expect(bars[1].totalHeight).toBeGreaterThan(bars[0].totalHeight);
    expect(bars[1].confirmedHeight).toBeLessThan(bars[1].totalHeight);
  });

  it('describes the graph for a reader who cannot see it', async () => {
    const { page } = await render();

    expect(page.chartLabel()).toContain('2026-08-17');
    expect(page.chartLabel()).toContain('3 weeks');
  });

  it('says what a filtered count is a subset of', async () => {
    const { page } = await render({ status: 'pending' });

    expect(page.matchLabel()).toBe('1 of 3 registrations');
  });

  it('counts the pages from the total, not from the rows on screen', async () => {
    const { page } = await render();

    expect(page.pages()).toBe(1);
  });
});
