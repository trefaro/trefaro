import { TestBed } from '@angular/core/testing';
import { OrganizerRooms } from './organizer-rooms';
import { RoomPlanningApi } from './room-planning-api';
import {
  FakeApi,
  STRINGS,
  all,
  booking,
  buttons,
  plan,
  planned,
  room,
  session,
  settle,
  submit,
  textOf,
} from './testing';

/**
 * The room editor on the event dashboard (FR 3.11, E50).
 *
 * The section the plug-in draws at `event-dashboard`: every room with its
 * seats, the sessions in it with their sign-ups, and the two warnings at the
 * session and at the room. What these tests hold on to is that every write
 * goes through the plug-in's own routes and is followed by a fresh read of the
 * plan — the warnings are computed on the server, so an editor that edited its
 * own copy would show a plan the server does not have.
 */
describe('OrganizerRooms', () => {
  let api: FakeApi;

  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: RoomPlanningApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(OrganizerRooms);
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

  const field = (fixture: Fixture, scope: string, name: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(
      `${scope} [name="${name}"]`,
    ) as HTMLInputElement;

  const form = (fixture: Fixture, selector: string): HTMLFormElement =>
    (fixture.nativeElement as HTMLElement).querySelector(
      selector,
    ) as HTMLFormElement;

  /** Two rooms: one overbooked plenary, one double booking. */
  function twoRooms() {
    const plenary = booking({ signupCount: 45, warnings: ['overbooked'] });
    const workshop = booking({
      programItemId: 'workshop',
      title: 'Door-to-door',
      startsAt: '2027-06-14T09:00:00.000Z',
      endsAt: '2027-06-14T10:30:00.000Z',
      signupCount: 5,
      warnings: ['double-booked'],
    });
    const panel = booking({
      programItemId: 'panel',
      title: 'Podium',
      startsAt: '2027-06-14T09:30:00.000Z',
      endsAt: '2027-06-14T10:00:00.000Z',
      warnings: ['double-booked'],
    });
    const closing = session({ programItemId: 'closing', title: 'Closing' });
    return plan(
      [
        planned({ bookings: [plenary], warnings: ['overbooked'] }),
        planned({
          room: room({ id: 'room-b', name: 'Raum B', capacity: 20 }),
          bookings: [workshop, panel],
          warnings: ['double-booked'],
        }),
      ],
      [plenary, workshop, panel, closing],
    );
  }

  beforeEach(() => {
    api = new FakeApi();
  });

  it('draws every room with its seats, its sessions with their sign-ups, and the warnings at both (E50)', async () => {
    api.answer = twoRooms();

    const fixture = await render({ eventId: 'event-1' });

    expect(all(fixture, '.room__name').map((node) => node.textContent)).toEqual(
      ['Saal A', 'Raum B'],
    );
    expect(all(fixture, '.room__meta')[0].textContent).toMatch(/40\s*Plätze/);
    expect(
      all(fixture, '.booking__title').map((node) => node.textContent),
    ).toEqual(['Opening plenary', 'Door-to-door', 'Podium']);
    expect(all(fixture, '.booking__signups')[0].textContent).toMatch(
      /45\s*angemeldet/,
    );

    // The warning at the session and at the room, in words — a room in
    // trouble is spotted at the room, what the trouble is at the session.
    const rooms = all(fixture, '.room');
    expect(
      all(fixture, '.room__warnings .warning').map((node) =>
        node.textContent?.trim(),
      ),
    ).toEqual(['Überbucht', 'Doppelbelegung']);
    expect(
      Array.from(rooms[0].querySelectorAll('.booking .warning')).map((node) =>
        node.textContent?.trim(),
      ),
    ).toEqual(['Überbucht']);
    expect(
      Array.from(rooms[1].querySelectorAll('.booking .warning')).map((node) =>
        node.textContent?.trim(),
      ),
    ).toEqual(['Doppelbelegung', 'Doppelbelegung']);
    expect(textOf(fixture)).toContain(STRINGS['intro']);
  });

  it("draws the slots in the event's zone, not in the organizer's (E69)", async () => {
    // The same rule as on the participant's side, and it matters more here:
    // an organizer filling rooms from another country would otherwise place
    // sessions against hours the event does not run at.
    vi.stubEnv('TZ', 'America/Toronto');
    try {
      api.answer = plan([planned({ bookings: [booking()] })]);

      const fixture = await render({ eventId: 'event-1' });
      const slot = all(fixture, '.booking__time')[0].textContent ?? '';

      expect(slot).toContain('09:00');
      expect(slot).not.toContain('03:00');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('says so when there are no rooms yet, and offers to add the first', async () => {
    const fixture = await render({ eventId: 'event-1' });

    expect(textOf(fixture)).toContain(STRINGS['emptyPlan']);
    expect(buttons(fixture, 'Raum hinzufügen')).toHaveLength(1);
  });

  it('adds a room through its own route and reads the plan again', async () => {
    const fixture = await render({ eventId: 'event-1' });
    const readsBefore = api.reads;

    buttons(fixture, 'Raum hinzufügen')[0].click();
    fixture.detectChanges();
    field(fixture, '.room-form', 'name').value = '  Saal A ';
    field(fixture, '.room-form', 'capacity').value = '40';
    field(fixture, '.room-form', 'floor').value = 'Erdgeschoss';
    submit(form(fixture, '.room-form'));
    await settle(fixture);

    // Trimming and the rules are the server's; the bundle sends what was typed
    // and an empty optional field as null.
    expect(api.created).toEqual([
      {
        eventId: 'event-1',
        input: {
          name: '  Saal A ',
          capacity: 40,
          floor: 'Erdgeschoss',
          description: null,
        },
      },
    ]);
    expect(api.reads).toBe(readsBefore + 1);
    // The form is gone once the room is; the button is back.
    expect(form(fixture, '.room-form')).toBeNull();
    expect(buttons(fixture, 'Raum hinzufügen')).toHaveLength(1);
  });

  it('renames a room and changes its seats, starting from what it has', async () => {
    api.answer = plan([planned({ room: room({ floor: 'Erdgeschoss' }) })]);
    const fixture = await render({ eventId: 'event-1' });

    buttons(fixture, 'Bearbeiten')[0].click();
    fixture.detectChanges();
    // The form starts from the room as it is, so a rename does not have to
    // retype the seats.
    expect(field(fixture, '.room-form', 'name').value).toBe('Saal A');
    expect(field(fixture, '.room-form', 'capacity').value).toBe('40');
    expect(field(fixture, '.room-form', 'floor').value).toBe('Erdgeschoss');

    field(fixture, '.room-form', 'name').value = 'Großer Saal';
    field(fixture, '.room-form', 'capacity').value = '35';
    field(fixture, '.room-form', 'floor').value = '';
    submit(form(fixture, '.room-form'));
    await settle(fixture);

    expect(api.updated).toEqual([
      {
        roomId: 'room-a',
        changes: {
          name: 'Großer Saal',
          capacity: 35,
          floor: null,
          description: null,
        },
      },
    ]);
    expect(form(fixture, '.room-form')).toBeNull();
  });

  it('closes the form again without writing when the change is cancelled', async () => {
    api.answer = plan([planned()]);
    const fixture = await render({ eventId: 'event-1' });

    buttons(fixture, 'Bearbeiten')[0].click();
    fixture.detectChanges();
    buttons(fixture, 'Abbrechen')[0].click();
    fixture.detectChanges();

    expect(api.updated).toEqual([]);
    expect(form(fixture, '.room-form')).toBeNull();
  });

  it('deletes a room through its own route, saying beforehand what that takes along', async () => {
    api.answer = plan([planned()]);
    const fixture = await render({ eventId: 'event-1' });
    const readsBefore = api.reads;

    expect(textOf(fixture)).toContain(STRINGS['deleteNote']);
    buttons(fixture, 'Löschen')[0].click();
    await settle(fixture);

    expect(api.deleted).toEqual(['room-a']);
    expect(api.reads).toBe(readsBefore + 1);
  });

  it('puts a chosen session in a room, offering only the ones not already in it', async () => {
    api.answer = twoRooms();
    const fixture = await render({ eventId: 'event-1' });

    // Raum B holds the workshop and the panel; what it can still take is the
    // plenary and the closing.
    const picker = all(fixture, '.place-form select')[1] as HTMLSelectElement;
    expect(Array.from(picker.options).map((option) => option.value)).toEqual([
      'plenary',
      'closing',
    ]);
    // Named by title and time, because a session id is nothing to choose by.
    expect(picker.options[1].textContent).toContain('Closing');

    picker.value = 'closing';
    submit(form(fixture, '.room:nth-of-type(2) .place-form'));
    await settle(fixture);

    expect(api.placed).toEqual([{ itemId: 'closing', roomId: 'room-b' }]);
  });

  it('takes a session out of a room', async () => {
    api.answer = twoRooms();
    const fixture = await render({ eventId: 'event-1' });

    buttons(fixture, 'Herausnehmen')[2].click();
    await settle(fixture);

    expect(api.removed).toEqual([{ itemId: 'panel', roomId: 'room-b' }]);
  });

  it('says when a room has nothing left to take', async () => {
    const plenary = booking();
    api.answer = plan([planned({ bookings: [plenary] })], [plenary]);

    const fixture = await render({ eventId: 'event-1' });

    expect(textOf(fixture)).toContain(STRINGS['nothingToPlace']);
    expect(all(fixture, '.place-form select')).toHaveLength(0);
  });

  it('says when the event has no sessions at all', async () => {
    api.answer = plan([planned()], []);

    const fixture = await render({ eventId: 'event-1' });

    expect(textOf(fixture)).toContain(STRINGS['noSessions']);
  });

  it('says so when a write did not go through, and keeps what was typed', async () => {
    api.failWrite = true;
    const fixture = await render({ eventId: 'event-1' });

    buttons(fixture, 'Raum hinzufügen')[0].click();
    fixture.detectChanges();
    field(fixture, '.room-form', 'name').value = 'Saal A';
    field(fixture, '.room-form', 'capacity').value = '40';
    submit(form(fixture, '.room-form'));
    await settle(fixture);

    expect(textOf(fixture)).toContain(STRINGS['error']);
    // Nothing was written, so nothing may look written: the form stays, with
    // what was typed in it.
    expect(field(fixture, '.room-form', 'name').value).toBe('Saal A');
  });

  it('waits for the event id rather than asking about nothing', async () => {
    await render();

    expect(api.reads).toBe(0);
  });
});
