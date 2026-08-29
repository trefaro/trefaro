import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  EventDashboard,
  EventStatus,
  MediaLinkSummary,
  OrganizerEvent,
  ParticipantRow,
} from '@trefaro/shared-models';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { EventDashboardPage } from './event-dashboard-page';

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
  venueName: 'Bürgerhaus Kalk',
  venueAddress: null,
  onlineUrl: null,
  languages: ['de'],
  followUpBody: null,
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
    status: 'confirmed',
    newsletterOptIn: false,
    contactOptOut: false,
    registeredAt: '2026-08-24T09:30:00.000Z',
    confirmedAt: '2026-08-24T10:00:00.000Z',
    customFields: {},
    ...overrides,
  };
}

function dashboard(overrides: Partial<EventDashboard> = {}): EventDashboard {
  return {
    event: EVENT,
    seriesSlug: 'democracy-days',
    registrations: { total: 7, pending: 4, confirmed: 2, cancelled: 1 },
    latestRegistrations: [row()],
    program: { items: 4, withSignup: 2, signups: 9 },
    form: { questions: 3, required: 2 },
    mediaLinks: { links: 3, streams: 1, recordings: 2, materials: 0 },
    ...overrides,
  };
}

/** The template drives protected members; the tests reach them the same way. */
interface PageInternals {
  address: () => string;
  when: () => string;
  participantsMeta: () => string;
  programMeta: () => string;
  formMeta: () => string;
  mediaMeta: (media: MediaLinkSummary) => string;
  setStatus: (status: EventStatus) => void;
  registeredAt: (iso: string) => string;
}

class FakeEventsAdminService {
  readonly asked: string[] = [];
  readonly updates: { id: string; status?: EventStatus }[] = [];
  view: EventDashboard | null = dashboard();
  failure: { status: number; message: string } | null = null;

  dashboard(id: string): Promise<EventDashboard> {
    this.asked.push(id);
    if (this.failure) return Promise.reject(this.failure);
    return Promise.resolve(this.view as EventDashboard);
  }

  update(id: string, input: { status?: EventStatus }): Promise<OrganizerEvent> {
    this.updates.push({ id, status: input.status });
    this.view = dashboard({
      event: { ...EVENT, status: input.status ?? EVENT.status },
    });
    return Promise.resolve(EVENT);
  }
}

async function render(
  seeded: {
    view?: EventDashboard;
    failure?: { status: number; message: string };
  } = {},
): Promise<{
  page: PageInternals;
  events: FakeEventsAdminService;
  text: () => string;
  links: () => string[];
  settle: () => Promise<void>;
}> {
  const events = new FakeEventsAdminService();
  if (seeded.view !== undefined) events.view = seeded.view;
  if (seeded.failure) events.failure = seeded.failure;

  TestBed.configureTestingModule({
    providers: [
      // The lines under the tiles are assembled here, so this spec brings the
      // English texts they are assembled from rather than the keys.
      provideTranslationsForTest({
        'admin.participants.title': 'Participants',
        'admin.program.title': 'Programme',
        'admin.fields.title': 'Registration form',
        'modules.mediaLinks.title': 'Media links',
        'admin.dashboard.allParticipants': 'All participants',
        'admin.dashboard.empty': 'Nobody has registered for this event yet.',
        'admin.dashboard.metaNobody': 'Nobody has registered yet.',
        'admin.dashboard.metaPending': '{{count}} awaiting confirmation',
        'admin.dashboard.metaCancelled': '{{count}} cancelled',
        'admin.dashboard.metaAllConfirmed': 'Every registration is confirmed.',
        'admin.dashboard.metaNoProgram': 'No programme yet.',
        'admin.dashboard.metaNoSignup': 'No session asks who is coming.',
        'admin.dashboard.metaSeats.manyMany':
          '{{seats}} seats taken in {{sessions}} sessions',
        'admin.dashboard.metaNoMedia': 'Nothing linked yet.',
        'admin.dashboard.metaCount': '{{count}} {{label}}',
        'mediaLinks.kind.stream.one': 'stream',
        'mediaLinks.kind.recording.many': 'recordings',
        'admin.dashboard.metaStandardFields': 'Only the standard fields.',
        'admin.dashboard.metaRequired': '{{count}} of them required.',
        'admin.events.errorMissing': 'This event no longer exists.',
        'eventStatus.draft': 'draft',
      }),
      provideRouter([]),
      { provide: EventsAdminService, useValue: events },
    ],
  });

  const fixture = TestBed.createComponent(EventDashboardPage);
  fixture.componentRef.setInput('seriesId', 'series-1');
  fixture.componentRef.setInput('eventId', 'event-1');
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  const host = fixture.nativeElement as HTMLElement;
  return {
    page: fixture.componentInstance as unknown as PageInternals,
    events,
    text: () => host.textContent ?? '',
    links: () =>
      [...host.querySelectorAll('a')].map((link) =>
        (link.textContent ?? '').trim(),
      ),
    settle: async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    },
  };
}

describe('EventDashboardPage', () => {
  it('asks for the whole dashboard in one request', async () => {
    const { events } = await render();

    expect(events.asked).toEqual(['event-1']);
  });

  it('leads to every view it summarizes', async () => {
    const { links } = await render();

    // Each tile is a link, and its name is the view — a number an organizer
    // cannot act on is decoration (FR 3.8).
    expect(links()).toContain('Participants');
    expect(links()).toContain('Programme');
    expect(links()).toContain('Registration form');
    expect(links()).toContain('Media links');
    expect(links()).toContain('All participants');
  });

  it('has no media tile while the module is switched off', async () => {
    const { links, text } = await render({
      view: dashboard({ mediaLinks: null }),
    });

    // `null` from the server means the organization switched `media-links` off
    // (FR 1.5). Its endpoints then answer 404 (F53), so the tile would be a dead
    // end drawn as a feature — and a zero would be a claim about data (F47).
    expect(links()).not.toContain('Media links');
    expect(text()).not.toContain('Nothing linked yet.');
  });

  it('shows the e-mail address in the table of latest registrations', async () => {
    const { text } = await render();

    // The same correction as in the participant overview (E13).
    expect(text()).toContain('amina@example.org');
    expect(text()).toContain('Okonkwo, Amina');
  });

  it('shows the nested public address of the event (E7, F28)', async () => {
    const { page } = await render();

    expect(page.address()).toBe('/series/democracy-days/events/kickoff');
  });

  it("reads times in the event's zone, not the browser's (E8)", async () => {
    const { page } = await render();

    // 09:30 UTC is 11:30 in Cologne. A page that formatted in the runner's zone
    // would pass here only by accident.
    expect(page.registeredAt('2026-08-24T09:30:00.000Z')).toContain('11:30');
  });

  describe('what the tiles say underneath the number', () => {
    it('names what is not confirmed yet and what will not come', async () => {
      const { page } = await render();

      expect(page.participantsMeta()).toBe(
        '4 awaiting confirmation · 1 cancelled',
      );
    });

    it('says so when every registration is confirmed', async () => {
      const { page } = await render({
        view: dashboard({
          registrations: { total: 2, pending: 0, confirmed: 2, cancelled: 0 },
        }),
      });

      expect(page.participantsMeta()).toBe('Every registration is confirmed.');
    });

    it('does not pretend an empty event has confirmations', async () => {
      const { page, text } = await render({
        view: dashboard({
          registrations: { total: 0, pending: 0, confirmed: 0, cancelled: 0 },
          latestRegistrations: [],
        }),
      });

      expect(page.participantsMeta()).toBe('Nobody has registered yet.');
      expect(text()).toContain('Nobody has registered for this event yet.');
    });

    it('reports seats only where a session asks for them', async () => {
      const { page } = await render();

      expect(page.programMeta()).toBe('9 seats taken in 2 sessions');
    });

    it('says a programme without sign-up does not ask who is coming', async () => {
      const { page } = await render({
        view: dashboard({ program: { items: 3, withSignup: 0, signups: 0 } }),
      });

      expect(page.programMeta()).toBe('No session asks who is coming.');
    });

    it('distinguishes an empty programme from one without sign-up', async () => {
      const { page } = await render({
        view: dashboard({ program: { items: 0, withSignup: 0, signups: 0 } }),
      });

      expect(page.programMeta()).toBe('No programme yet.');
    });

    it('counts the questions of the form and how many are required', async () => {
      const { page } = await render();

      expect(page.formMeta()).toBe('2 of them required.');
    });

    it('says a form with no extra questions has only the standard fields', async () => {
      const { page } = await render({
        view: dashboard({ form: { questions: 0, required: 0 } }),
      });

      expect(page.formMeta()).toBe('Only the standard fields.');
    });

    it('names the kinds of media that are there, and leaves out the rest', async () => {
      const { page } = await render();

      // What is missing before an event and what arrived after it — a tally of
      // three numbers including zeros would not say that.
      expect(
        page.mediaMeta({
          links: 3,
          streams: 1,
          recordings: 2,
          materials: 0,
        }),
      ).toBe('1 stream · 2 recordings');
    });

    it('says an event with the module on but nothing linked has nothing linked', async () => {
      const { page, text } = await render({
        view: dashboard({
          mediaLinks: { links: 0, streams: 0, recordings: 0, materials: 0 },
        }),
      });

      // A tile with a zero *is* right here: the module exists, and the number is
      // an invitation to add the first link.
      expect(
        page.mediaMeta({ links: 0, streams: 0, recordings: 0, materials: 0 }),
      ).toBe('Nothing linked yet.');
      expect(text()).toContain('Nothing linked yet.');
    });
  });

  it('publishes and unpublishes the event from its dashboard', async () => {
    const { page, events, settle, text } = await render();

    page.setStatus('draft');
    // Twice: the change and the reload behind it are two awaits deep.
    await settle();
    await settle();

    expect(events.updates).toEqual([{ id: 'event-1', status: 'draft' }]);
    // Reloaded rather than patched in place: the numbers may have moved too.
    expect(events.asked).toEqual(['event-1', 'event-1']);
    expect(text()).toContain('draft');
  });

  it('says an event is gone rather than showing an empty dashboard', async () => {
    const { text } = await render({
      failure: { status: 404, message: 'No event with that id' },
    });

    expect(text()).toContain('This event no longer exists.');
  });
});
