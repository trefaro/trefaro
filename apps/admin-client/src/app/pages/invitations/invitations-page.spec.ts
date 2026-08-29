import type { Problem } from '@trefaro/shared-http';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  ContactQuery,
  EventSeries,
  Invitation,
  InvitationInput,
  InvitationPage,
  OrganizerEvent,
  SeriesContact,
  SeriesContactPage,
} from '@trefaro/shared-models';
import { EventSeriesAdminService } from '../../features/event-series/event-series-admin.service';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { InvitationsAdminService } from '../../features/invitations/invitations-admin.service';
import { InvitationsPage } from './invitations-page';

const SERIES = {
  id: 'series-1',
  slug: 'democracy-days',
  name: 'Democracy Days',
} as EventSeries;

const EVENT = {
  id: 'event-1',
  seriesId: 'series-1',
  slug: 'kickoff',
  name: 'Kickoff in Köln',
  startsAt: '2099-03-28T08:00:00.000Z',
  endsAt: '2099-03-28T15:00:00.000Z',
  timezone: 'Europe/Berlin',
} as OrganizerEvent;

function contact(overrides: Partial<SeriesContact> = {}): SeriesContact {
  return {
    registrationId: 'registration-1',
    email: 'amina@example.org',
    firstName: 'Amina',
    lastName: 'Okonkwo',
    events: 2,
    lastRegisteredAt: '2026-08-24T09:30:00.000Z',
    ...overrides,
  };
}

function invitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'invitation-1',
    seriesId: 'series-1',
    eventId: null,
    subject: 'You are invited',
    body: 'Come along.',
    state: 'sent',
    recipients: 3,
    sent: 3,
    failed: 0,
    createdAt: '2026-08-27T10:00:00.000Z',
    finishedAt: '2026-08-27T10:02:00.000Z',
    ...overrides,
  };
}

/** The template drives protected members; the tests reach them the same way. */
interface PageInternals {
  selected: () => ReadonlySet<string>;
  toggle: (contact: SeriesContact) => void;
  selectPage: (rows: readonly SeriesContact[]) => void;
  allOnPage: (rows: readonly SeriesContact[]) => boolean;
  go: (step: number) => void;
  progress: (invitation: Invitation) => string;
  sendLabel: () => string;
  notice: () => {
    key: string;
    params: Readonly<Record<string, unknown>>;
  } | null;
  error: () => Problem | null;
  send: (event: Event) => Promise<void>;
  form: {
    setValue: (value: {
      subject: string;
      body: string;
      eventId: string;
    }) => void;
  };
}

class FakeInvitationsAdminService {
  contactPages: SeriesContactPage[] = [
    { rows: [contact()], total: 1, page: 1, pageSize: 25 },
  ];
  invitationPage: InvitationPage = {
    rows: [invitation()],
    total: 1,
    page: 1,
    pageSize: 10,
  };
  readonly queries: ContactQuery[] = [];
  readonly sentInput: InvitationInput[] = [];
  failure: { message: string; explained: boolean } | null = null;
  contactReads = 0;
  invitationReads = 0;

  contacts(_seriesId: string, query: ContactQuery): Promise<SeriesContactPage> {
    this.queries.push(query);
    const index = Math.min(
      Math.max((query.page ?? 1) - 1, 0),
      this.contactPages.length - 1,
    );
    this.contactReads += 1;
    return Promise.resolve(this.contactPages[index]);
  }

  list(): Promise<InvitationPage> {
    this.invitationReads += 1;
    return Promise.resolve(this.invitationPage);
  }

  send(_seriesId: string, input: InvitationInput): Promise<Invitation> {
    this.sentInput.push(input);
    if (this.failure) return Promise.reject(this.failure);
    return Promise.resolve(
      invitation({
        recipients: input.recipients.length,
        state: 'sending',
        sent: 0,
      }),
    );
  }

  get(id: string): Promise<Invitation> {
    return Promise.resolve(invitation({ id }));
  }
}

async function render(
  seeded: {
    contactPages?: SeriesContactPage[];
    invitationPage?: InvitationPage;
    failure?: { message: string; explained: boolean };
  } = {},
): Promise<{
  page: PageInternals;
  invitations: FakeInvitationsAdminService;
  text: () => string;
  settle: () => Promise<void>;
}> {
  const invitations = new FakeInvitationsAdminService();
  if (seeded.contactPages) invitations.contactPages = seeded.contactPages;
  if (seeded.invitationPage) invitations.invitationPage = seeded.invitationPage;
  if (seeded.failure) invitations.failure = seeded.failure;

  TestBed.configureTestingModule({
    providers: [
      // The texts this spec is about: the two counted labels and the sentences
      // an organizer is told to read. Everything else stays a key.
      provideTranslationsForTest({
        'admin.invitations.hint':
          'These are the addresses that registered for an event of this ' +
          'series and confirmed. An address that has objected is in no list ' +
          'here any more.',
        'admin.invitations.selectFirst': 'Select somebody first',
        'admin.invitations.sendTo.one': 'Send to {{count}} address',
        'admin.invitations.progressSending': 'Sending… {{sent}} of {{total}}',
        'admin.invitations.progressFailed':
          '{{sent}} sent, {{failed}} could not be delivered',
        'admin.invitations.progressDone': '{{sent}} sent',
        'admin.invitations.nothingSent':
          'Nothing has been sent for this series yet.',
        'admin.invitations.noContacts':
          'Nobody has confirmed a registration for this series yet.',
      }),
      provideRouter([]),
      { provide: InvitationsAdminService, useValue: invitations },
      {
        provide: EventSeriesAdminService,
        useValue: { get: () => Promise.resolve(SERIES) },
      },
      {
        provide: EventsAdminService,
        useValue: { listBySeries: () => Promise.resolve([EVENT]) },
      },
    ],
  });

  const fixture = TestBed.createComponent(InvitationsPage);
  fixture.componentRef.setInput('seriesId', 'series-1');
  fixture.detectChanges();
  // Three passes: the page reads the series and its events first and only then
  // the contacts and the log, so the load is two awaits deep — and the render
  // after the last one has to happen too.
  for (let pass = 0; pass < 3; pass += 1) {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const host = fixture.nativeElement as HTMLElement;
  return {
    page: fixture.componentInstance as unknown as PageInternals,
    invitations,
    text: () => host.textContent ?? '',
    settle: async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    },
  };
}

describe('InvitationsPage', () => {
  it('shows the addresses of the series with their e-mail in the table', async () => {
    const { text } = await render();

    // The same correction as in the participant overview (E13): the address is
    // what an organizer picking an audience is looking at.
    expect(text()).toContain('Okonkwo, Amina');
    expect(text()).toContain('amina@example.org');
  });

  it('says why an address may be missing from the list (E15)', async () => {
    const { text } = await render();

    expect(text()).toMatch(/registered for an event of this series/i);
    expect(text()).toMatch(/objected/i);
  });

  it('offers nothing to send until somebody is selected', async () => {
    const { page } = await render();

    expect(page.sendLabel()).toBe('Select somebody first');
  });

  it('counts the selection in the button', async () => {
    const { page } = await render();

    page.toggle(contact());

    expect(page.sendLabel()).toBe('Send to 1 address');
  });

  it('keeps the selection when the page changes', async () => {
    const { page, invitations } = await render({
      contactPages: [
        { rows: [contact()], total: 2, page: 1, pageSize: 1 },
        {
          rows: [contact({ registrationId: 'registration-2' })],
          total: 2,
          page: 2,
          pageSize: 1,
        },
      ],
    });

    page.toggle(contact());
    page.go(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    page.toggle(contact({ registrationId: 'registration-2' }));

    // Somebody who picks twelve people on page one and three on page two writes
    // to fifteen — the selection is not the checkboxes on screen.
    expect([...page.selected()]).toEqual(['registration-1', 'registration-2']);
    expect(invitations.queries.at(-1)?.page).toBe(2);
  });

  it('selects and clears a whole page at once', async () => {
    const rows = [contact(), contact({ registrationId: 'registration-2' })];
    const { page } = await render({
      contactPages: [{ rows, total: 2, page: 1, pageSize: 25 }],
    });

    page.selectPage(rows);
    expect(page.selected().size).toBe(2);
    expect(page.allOnPage(rows)).toBe(true);

    page.selectPage(rows);
    expect(page.selected().size).toBe(0);
  });

  it('sends registration ids, never addresses (F55)', async () => {
    const { page, invitations, settle } = await render();

    page.toggle(contact());
    page.form.setValue({
      subject: 'You are invited',
      body: 'Come along.',
      eventId: '',
    });
    await page.send(new Event('submit'));
    await settle();

    expect(invitations.sentInput).toEqual([
      {
        subject: 'You are invited',
        body: 'Come along.',
        eventId: null,
        recipients: ['registration-1'],
      },
    ]);
  });

  it('passes on the event when one was chosen', async () => {
    const { page, invitations, settle } = await render();

    page.toggle(contact());
    page.form.setValue({
      subject: 'You are invited',
      body: 'Come along.',
      eventId: 'event-1',
    });
    await page.send(new Event('submit'));
    await settle();

    expect(invitations.sentInput[0].eventId).toBe('event-1');
  });

  it('says the sending continues without the page (F56)', async () => {
    const { page, settle } = await render();

    page.toggle(contact());
    page.form.setValue({
      subject: 'You are invited',
      body: 'Come along.',
      eventId: '',
    });
    await page.send(new Event('submit'));
    await settle();

    // The key and its count, not a finished sentence: the notice stays on
    // screen and follows a language change like everything else (F72).
    expect(page.notice()?.key).toBe('admin.invitations.onTheWay.one');
    expect(page.notice()?.params).toEqual({ count: 1 });
  });

  it('clears the selection and the form after sending', async () => {
    const { page, settle } = await render();

    page.toggle(contact());
    page.form.setValue({
      subject: 'You are invited',
      body: 'Come along.',
      eventId: '',
    });
    await page.send(new Event('submit'));
    await settle();

    // Otherwise the next click would write to the same people again.
    expect(page.selected().size).toBe(0);
    expect(page.sendLabel()).toBe('Select somebody first');
  });

  it('reads the list again after sending', async () => {
    const { page, invitations, settle } = await render();
    const before = invitations.contactReads;

    page.toggle(contact());
    page.form.setValue({
      subject: 'You are invited',
      body: 'Come along.',
      eventId: '',
    });
    await page.send(new Event('submit'));
    await settle();

    // Somebody may have objected between loading the list and sending.
    expect(invitations.contactReads).toBeGreaterThan(before);
  });

  it('sends nothing when the form is empty', async () => {
    const { page, invitations } = await render();

    page.toggle(contact());
    await page.send(new Event('submit'));

    expect(invitations.sentInput).toHaveLength(0);
  });

  it('reports a refused selection instead of pretending it went out', async () => {
    const { page, settle } = await render({
      failure: {
        message: '1 of the selected addresses can no longer be written to',
        // The server's own reason, which is what the page shows beside its
        // sentence (F77); a status word would not be `explained`.
        explained: true,
      },
    });

    page.toggle(contact());
    page.form.setValue({
      subject: 'You are invited',
      body: 'Come along.',
      eventId: '',
    });
    await page.send(new Event('submit'));
    await settle();

    expect(page.error()?.key).toBe('admin.invitations.errorSend');
    expect(page.error()?.detail).toMatch(/no longer be written to/);
    expect(page.notice()).toBeNull();
  });

  describe('the progress of a send', () => {
    it('counts up while it is running', async () => {
      const { page } = await render();

      expect(
        page.progress(
          invitation({ state: 'sending', sent: 34, recipients: 200 }),
        ),
      ).toBe('Sending… 34 of 200');
    });

    it('names how many could not be delivered', async () => {
      const { page } = await render();

      expect(
        page.progress(
          invitation({
            state: 'partial',
            sent: 198,
            failed: 2,
            recipients: 200,
          }),
        ),
      ).toBe('198 sent, 2 could not be delivered');
    });

    it('says only the number when everything went out', async () => {
      const { page } = await render();

      expect(page.progress(invitation())).toBe('3 sent');
    });
  });

  it('says nothing has been sent yet rather than showing an empty table', async () => {
    const { text } = await render({
      invitationPage: { rows: [], total: 0, page: 1, pageSize: 10 },
    });

    expect(text()).toContain('Nothing has been sent for this series yet.');
  });

  it('distinguishes an empty series from an empty search', async () => {
    const { text } = await render({
      contactPages: [{ rows: [], total: 0, page: 1, pageSize: 25 }],
    });

    expect(text()).toContain(
      'Nobody has confirmed a registration for this series yet.',
    );
  });
});
