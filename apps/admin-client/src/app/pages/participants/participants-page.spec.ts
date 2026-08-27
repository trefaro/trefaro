import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type {
  AttachmentSummary,
  OrganizerEvent,
  ParticipantDetail,
  ParticipantPage as ParticipantPageModel,
  ParticipantQuery,
  ParticipantRow,
  ParticipantSort,
  RegistrationField,
  RegistrationStatistics,
  RegistrationStatus,
} from '@trefaro/shared-models';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { AttachmentsAdminService } from '../../features/registrations/attachments-admin.service';
import { ParticipantsAdminService } from '../../features/registrations/participants-admin.service';
import { RegistrationFieldsAdminService } from '../../features/registrations/registration-fields-admin.service';
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
    customFields: {},
    ...overrides,
  };
}

const PASSPORT: AttachmentSummary = {
  id: 'attachment-1',
  fieldKey: 'passport',
  fileName: 'passport.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 428_112,
  uploadedAt: '2026-08-24T09:30:00.000Z',
};

const FIELDS: readonly RegistrationField[] = [
  {
    id: 'field-1',
    eventId: 'event-1',
    key: 'dietary-requirements',
    label: 'Dietary requirements',
    type: 'text',
    helpText: null,
    options: [],
    accept: [],
    maxSizeBytes: null,
    required: false,
    sort: 0,
  },
  {
    id: 'field-2',
    eventId: 'event-1',
    key: 'visa',
    label: 'Needs a visa letter',
    type: 'checkbox',
    helpText: null,
    options: [],
    accept: [],
    maxSizeBytes: null,
    required: false,
    sort: 1,
  },
  {
    id: 'field-3',
    eventId: 'event-1',
    key: 'passport',
    label: 'Passport scan',
    type: 'file',
    helpText: null,
    options: [],
    accept: ['application/pdf'],
    maxSizeBytes: 5 * 1024 * 1024,
    required: true,
    sort: 2,
  },
];

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

/** Records what the detail panel asks to be downloaded (E9). */
class FakeAttachmentsAdminService {
  readonly saved: AttachmentSummary[] = [];

  async save(attachment: AttachmentSummary): Promise<void> {
    this.saved.push(attachment);
  }
}

/** The template drives protected members; the tests reach them the same way. */
interface PageInternals {
  answers: () => readonly { label: string; value: string }[];
  leftovers: () => readonly { key: string; value: string }[];
  documents: () => readonly {
    key: string;
    label: string;
    file: AttachmentSummary | null;
  }[];
  download: (file: AttachmentSummary) => Promise<void>;
  size: (file: AttachmentSummary) => string;
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

async function render(
  params: Partial<Record<string, string>> = {},
  seeded: {
    fields?: readonly RegistrationField[];
    detail?: ParticipantDetail;
  } = {},
): Promise<{
  page: PageInternals;
  participants: FakeParticipantsAdminService;
  attachments: FakeAttachmentsAdminService;
  navigations: Navigation[];
  settle: () => Promise<void>;
}> {
  const participants = new FakeParticipantsAdminService();
  const attachments = new FakeAttachmentsAdminService();
  // Before the component exists: the detail panel is loaded by an effect on the
  // first change detection, and setting it afterwards would not re-run.
  participants.detail = seeded.detail ?? null;
  const fields = seeded.fields ?? FIELDS;

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ParticipantsAdminService, useValue: participants },
      {
        provide: EventsAdminService,
        useValue: { get: () => Promise.resolve(EVENT) },
      },
      {
        provide: RegistrationFieldsAdminService,
        useValue: { list: () => Promise.resolve(fields) },
      },
      { provide: AttachmentsAdminService, useValue: attachments },
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
    attachments,
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

  describe('the answers to the configurable fields (F12)', () => {
    const detail = (
      customFields: Record<string, string | boolean>,
      attachments: readonly AttachmentSummary[] = [],
    ) => ({
      ...row({ customFields }),
      eventId: 'event-1',
      eventName: EVENT.name,
      attachments,
    });

    it('labels every question the event asks, answered or not', async () => {
      const { page } = await render(
        { selected: 'registration-1' },
        { detail: detail({ 'dietary-requirements': 'vegan' }) },
      );

      // The unanswered field is listed too: an empty answer to a question the
      // organizer asked is information, and a row that vanishes looks unasked.
      expect(page.answers()).toEqual([
        { label: 'Dietary requirements', value: 'vegan' },
        { label: 'Needs a visa letter', value: '—' },
      ]);
    });

    it('reads a checkbox answer as yes and no, not as true and false', async () => {
      const { page } = await render(
        { selected: 'registration-1' },
        { detail: detail({ visa: false }) },
      );

      expect(page.answers().at(1)).toEqual({
        label: 'Needs a visa letter',
        value: 'no',
      });
    });

    it('lists every file field, and what arrived for it (E9)', async () => {
      const { page } = await render(
        { selected: 'registration-1' },
        { detail: detail({}, [PASSPORT]) },
      );

      // A file field is not answered with a value (F37), so it does not appear
      // among the answers — it appears with the name of what was uploaded.
      expect(page.answers().map((answer) => answer.label)).not.toContain(
        'Passport scan',
      );
      expect(page.documents()).toEqual([
        { key: 'passport', label: 'Passport scan', file: PASSPORT },
      ]);
      expect(page.size(PASSPORT)).toBe('418 KB');
    });

    it('says so when a required file is still missing', async () => {
      const { page } = await render(
        { selected: 'registration-1' },
        { detail: detail({}) },
      );

      // An organizer chasing a visa document needs to see that it is missing.
      expect(page.documents()).toEqual([
        { key: 'passport', label: 'Passport scan', file: null },
      ]);
    });

    it('keeps showing a file whose question was removed (F34)', async () => {
      const { page } = await render(
        { selected: 'registration-1' },
        {
          fields: [],
          detail: detail({}, [PASSPORT]),
        },
      );

      // Under its bare key, like a leftover answer: the organizer removed the
      // question, not the document.
      expect(page.documents()).toEqual([
        { key: 'passport', label: 'passport', file: PASSPORT },
      ]);
    });

    it('fetches a file instead of linking to the upload volume', async () => {
      const { page, attachments } = await render(
        { selected: 'registration-1' },
        { detail: detail({}, [PASSPORT]) },
      );

      await page.download(PASSPORT);

      // The volume has no public URL at all (E9); the bytes come through the
      // administrative session.
      expect(attachments.saved).toEqual([PASSPORT]);
    });

    it('keeps showing an answer whose question was removed (F34)', async () => {
      const { page } = await render(
        { selected: 'registration-1' },
        { detail: detail({ 'shirt-size': 'L' }) },
      );

      // The organizer removed the question, not the answer.
      expect(page.leftovers()).toEqual([{ key: 'shirt-size', value: 'L' }]);
    });
  });
});
