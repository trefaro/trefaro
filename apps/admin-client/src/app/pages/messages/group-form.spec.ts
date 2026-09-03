import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import type {
  EventSeries,
  GroupCandidate,
  NewGroupRequest,
  OrganizerConversationDetail,
  OrganizerEvent,
} from '@trefaro/shared-models';
import { describe, expect, it } from 'vitest';
import { ConversationsAdminService } from '../../features/chat/conversations-admin.service';
import { EventSeriesAdminService } from '../../features/event-series/event-series-admin.service';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { GroupForm } from './group-form';

const SERIES = [
  { id: 'series-1', name: 'Bürgerräte' } as EventSeries,
  { id: 'series-2', name: 'Assemblies' } as EventSeries,
];

const EVENTS: Record<string, OrganizerEvent[]> = {
  'series-1': [
    {
      id: 'event-1',
      seriesId: 'series-1',
      slug: 'kickoff',
      name: 'Kickoff in Köln',
      description: '',
      logoUrl: null,
      eventType: 'onsite',
      startsAt: '2099-03-28T08:00:00.000Z',
      endsAt: '2099-03-28T15:00:00.000Z',
      timezone: 'Europe/Berlin',
      venueName: null,
      venueAddress: null,
      onlineUrl: null,
      languages: ['de'],
      followUpBody: null,
      status: 'published',
      createdAt: '',
      updatedAt: '',
    },
  ],
  'series-2': [],
};

const CANDIDATES: GroupCandidate[] = [
  { profileId: 'profile-1', name: 'Amina Okonkwo', email: 'amina@example.org' },
  { profileId: 'profile-2', name: 'Bo Lindgren', email: 'bo@example.org' },
];

interface FormInternals {
  pickSeries: (event: Event) => Promise<void>;
  pickEvent: (event: Event) => Promise<void>;
  typedTopic: (event: Event) => void;
  toggle: (person: GroupCandidate) => void;
  selectAll: () => void;
  selectNone: () => void;
  create: () => Promise<void>;
  ready: () => boolean;
}

class FakeConversationsAdminService {
  candidateRows: GroupCandidate[] = CANDIDATES;
  candidatesFail = false;
  createFails: { status: number; message: string } | null = null;
  readonly created: NewGroupRequest[] = [];

  candidates(eventId: string): Promise<readonly GroupCandidate[]> {
    if (this.candidatesFail) {
      return Promise.reject({ status: 500, message: 'boom' });
    }
    return Promise.resolve(eventId ? this.candidateRows : []);
  }

  createGroup(group: NewGroupRequest): Promise<OrganizerConversationDetail> {
    if (this.createFails) return Promise.reject(this.createFails);
    this.created.push(group);
    return Promise.resolve({
      id: 'conversation-7',
      type: 'group',
      topic: group.topic,
      event: null,
      guest: null,
      memberCount: group.profileIds.length,
      lastMessageAt: null,
      preview: null,
      members: [],
    });
  }
}

async function render(
  seeded: { service?: FakeConversationsAdminService } = {},
) {
  const conversations = seeded.service ?? new FakeConversationsAdminService();
  const navigated: unknown[][] = [];

  TestBed.configureTestingModule({
    providers: [
      provideTranslationsForTest({
        'admin.messages.group.title': 'Assemble a group',
        'admin.messages.group.lead': 'A group belongs to one event.',
        'admin.messages.group.series': 'Series',
        'admin.messages.group.event': 'Event',
        'admin.messages.group.pick': 'Please choose',
        'admin.messages.group.topic': 'Subject',
        'admin.messages.group.members': 'Members',
        'admin.messages.group.selected': '{{count}} selected',
        'admin.messages.group.all': 'Select all',
        'admin.messages.group.none': 'Clear selection',
        'admin.messages.group.noCandidates':
          'Nobody at this event has a confirmed registration and an account.',
        'admin.messages.group.create': 'Create group',
        'admin.messages.group.creating': 'Creating…',
        'admin.messages.group.failed': 'The group could not be created.',
        'admin.messages.group.candidatesFailed':
          'Loading the participants failed.',
        'admin.messages.group.eventsFailed': 'Loading the events failed.',
      }),
      provideRouter([]),
      { provide: ConversationsAdminService, useValue: conversations },
      {
        provide: EventSeriesAdminService,
        useValue: { series: signal(SERIES), reload: () => Promise.resolve() },
      },
      {
        provide: EventsAdminService,
        useValue: {
          listBySeries: (id: string) => Promise.resolve(EVENTS[id] ?? []),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(GroupForm);
  fixture.detectChanges();
  await turns();
  fixture.detectChanges();

  const host = fixture.nativeElement as HTMLElement;
  const form = fixture.componentInstance as unknown as FormInternals;
  const settle = async () => {
    await turns();
    fixture.detectChanges();
  };

  return {
    conversations,
    form,
    navigated,
    text: () => host.textContent ?? '',
    checkboxes: () =>
      [...host.querySelectorAll('input[type=checkbox]')] as HTMLInputElement[],
    pickSeries: async (id: string) => {
      await form.pickSeries({ target: { value: id } } as unknown as Event);
      await settle();
    },
    pickEvent: async (id: string) => {
      await form.pickEvent({ target: { value: id } } as unknown as Event);
      await settle();
    },
    type: (value: string) => {
      form.typedTopic({ target: { value } } as unknown as Event);
    },
    settle,
  };
}

async function turns(): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
}

/**
 * Assembling a group (FR 4.5, E39 — AP 10).
 *
 * The three questions in the order the data requires them, and the property
 * that matters most: **nobody can be typed in.** Every member comes from the
 * candidate list of one event, and changing the event throws the selection
 * away rather than carrying it into a group it does not belong to.
 */
describe('GroupForm', () => {
  it('asks for a series before it can offer an event', async () => {
    const { text, pickSeries } = await render();

    expect(text()).toContain('Please choose');

    await pickSeries('series-1');

    expect(text()).toContain('Kickoff in Köln');
  });

  it('offers the confirmed participants of the chosen event', async () => {
    const { pickSeries, pickEvent, text } = await render();

    await pickSeries('series-1');
    await pickEvent('event-1');

    expect(text()).toContain('Amina Okonkwo');
    // The address beside the name, as everywhere an organizer reads a list of
    // people (E13): two people share a name.
    expect(text()).toContain('amina@example.org');
  });

  it('explains an event where nobody has both a place and an account', async () => {
    const service = new FakeConversationsAdminService();
    service.candidateRows = [];
    const { pickSeries, pickEvent, text } = await render({ service });

    await pickSeries('series-1');
    await pickEvent('event-1');

    expect(text()).toContain(
      'Nobody at this event has a confirmed registration and an account.',
    );
  });

  it('creates the group with exactly the people that were ticked', async () => {
    const { conversations, pickSeries, pickEvent, type, form, settle } =
      await render();

    await pickSeries('series-1');
    await pickEvent('event-1');
    type('Travel to Köln');
    form.toggle(CANDIDATES[0]);
    await settle();

    expect(form.ready()).toBe(true);
    await form.create();
    await settle();

    expect(conversations.created).toEqual([
      {
        eventId: 'event-1',
        topic: 'Travel to Köln',
        profileIds: ['profile-1'],
      },
    ]);
  });

  it('will not create a group without a subject or without members', async () => {
    const { conversations, pickSeries, pickEvent, type, form, settle } =
      await render();

    await pickSeries('series-1');
    await pickEvent('event-1');
    form.toggle(CANDIDATES[0]);
    await settle();

    // No subject yet: the schema requires one for this kind, and so does the
    // screen — before a request that could only fail.
    expect(form.ready()).toBe(false);
    await form.create();
    expect(conversations.created).toEqual([]);

    type('Travel');
    form.selectNone();
    await settle();
    expect(form.ready()).toBe(false);
  });

  it('throws the selection away when the event changes', async () => {
    const { pickSeries, pickEvent, form, checkboxes, settle } = await render();

    await pickSeries('series-1');
    await pickEvent('event-1');
    form.selectAll();
    await settle();
    expect(checkboxes().filter((box) => box.checked)).toHaveLength(2);

    // A selection made for one event must not travel into a group about
    // another: the server would refuse it, and silently keeping it would be a
    // form that lies about what it will send.
    await pickSeries('series-2');
    expect(checkboxes()).toHaveLength(0);
  });

  it('says so when the server refuses the group', async () => {
    const service = new FakeConversationsAdminService();
    service.createFails = { status: 400, message: 'not all confirmed' };
    const { pickSeries, pickEvent, type, form, text, settle } = await render({
      service,
    });

    await pickSeries('series-1');
    await pickEvent('event-1');
    type('Travel');
    form.toggle(CANDIDATES[0]);
    await settle();
    await form.create();
    await settle();

    expect(text()).toContain('The group could not be created.');
  });

  it('says so when the participants of an event cannot be loaded', async () => {
    const service = new FakeConversationsAdminService();
    service.candidatesFail = true;
    const { pickSeries, pickEvent, text } = await render({ service });

    await pickSeries('series-1');
    await pickEvent('event-1');

    expect(text()).toContain('Loading the participants failed.');
  });
});
