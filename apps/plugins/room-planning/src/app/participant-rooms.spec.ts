import { TestBed } from '@angular/core/testing';
import { ParticipantRooms } from './participant-rooms';
import { RoomPlanningApi } from './room-planning-api';
import {
  FakeApi,
  STRINGS,
  all,
  publicRoom,
  session,
  settle,
  textOf,
} from './testing';

/**
 * The room plan a participant reads (FR 3.6, E58) — the section at the event
 * detail hook point, for everybody.
 *
 * What these tests hold on to: every room with its seats and its sessions in
 * the order the server gave them; that the section asks again in the reader's
 * language, because the titles are translated on the server (E56); and that a
 * late answer to the old language does not win — the race the landing page
 * lost once (AP 5).
 */
describe('ParticipantRooms', () => {
  let api: FakeApi;

  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: RoomPlanningApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(ParticipantRooms);
    fixture.componentRef.setInput('strings', STRINGS);
    fixture.componentRef.setInput('locale', 'de');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await settle(fixture);
    return fixture;
  }

  beforeEach(() => {
    api = new FakeApi();
  });

  it('draws every room with its seats and its sessions, in the order they come', async () => {
    api.rooms = [
      publicRoom({
        floor: 'Erdgeschoss',
        description: 'Der große Saal am Eingang.',
        bookings: [
          session(),
          session({
            programItemId: 'panel',
            title: 'Podium',
            startsAt: '2027-06-14T09:00:00.000Z',
            endsAt: '2027-06-14T10:00:00.000Z',
          }),
        ],
      }),
      publicRoom({ id: 'room-b', name: 'Raum B', capacity: 20 }),
    ];

    const fixture = await render({ eventId: 'event-1' });

    expect(all(fixture, '.room__name').map((node) => node.textContent)).toEqual(
      ['Saal A', 'Raum B'],
    );
    expect(textOf(fixture)).toContain('Erdgeschoss');
    expect(textOf(fixture)).toContain('Der große Saal am Eingang.');
    expect(all(fixture, '.room__meta')[0].textContent).toMatch(/40\s*Plätze/);
    expect(
      all(fixture, '.booking__title').map((node) => node.textContent),
    ).toEqual(['Opening plenary', 'Podium']);
    // A slot is a time, from and to — in the reader's clock, since the slot
    // hands a plug-in no zone.
    expect(all(fixture, '.booking__time')[0].textContent).toMatch(
      /\d{1,2}:\d{2}.*–.*\d{1,2}:\d{2}/,
    );
  });

  it('says so when a room has nothing in it yet', async () => {
    api.rooms = [publicRoom()];

    const fixture = await render({ eventId: 'event-1' });

    expect(textOf(fixture)).toContain(STRINGS['noBookings']);
  });

  it('says so when there are no rooms, rather than drawing an empty list', async () => {
    const fixture = await render({ eventId: 'event-1' });

    expect(textOf(fixture)).toContain(STRINGS['emptyPlan']);
    expect(all(fixture, '.room')).toHaveLength(0);
  });

  it("asks again in the reader's language when it changes (E56)", async () => {
    const fixture = await render({ eventId: 'event-1' });

    fixture.componentRef.setInput('locale', 'en');
    fixture.detectChanges();
    await settle(fixture);

    // The translation lives on the server, so a switch is a second request —
    // a section that only redrew would keep the titles it already had.
    expect(api.publicReads).toEqual(['de', 'en']);
  });

  it('keeps the answer to the language it asked for last, whatever arrives later', async () => {
    api.defer = true;
    const fixture = await render({ eventId: 'event-1' });
    fixture.componentRef.setInput('locale', 'en');
    fixture.detectChanges();
    await settle(fixture);
    const [german, english] = api.pending;

    english([
      publicRoom({ bookings: [session({ title: 'Opening plenary' })] }),
    ]);
    await settle(fixture);
    expect(textOf(fixture)).toContain('Opening plenary');

    // Then the answer nobody is waiting for any more. It must not win.
    german([
      publicRoom({ bookings: [session({ title: 'Eröffnungsplenum' })] }),
    ]);
    await settle(fixture);
    expect(textOf(fixture)).toContain('Opening plenary');
    expect(textOf(fixture)).not.toContain('Eröffnungsplenum');
  });

  it('says so when the plan could not be loaded', async () => {
    api.failRead = true;

    const fixture = await render({ eventId: 'event-1' });

    expect(textOf(fixture)).toContain(STRINGS['error']);
  });

  it('waits for the event id rather than asking about nothing', async () => {
    await render();

    expect(api.publicReads).toEqual([]);
  });
});
