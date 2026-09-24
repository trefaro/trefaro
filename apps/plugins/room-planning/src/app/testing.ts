import type {
  NewRoom,
  PlannedRoom,
  PlannedSession,
  PublicRoom,
  Room,
  RoomBooking,
  RoomChanges,
  RoomPlan,
} from '@trefaro/shared-models';

/** What the host hands over under `plugins.roomPlanning.`, prefix stripped. */
export const STRINGS: Record<string, string> = {
  title: 'Raumplan',
  intro: 'Räume mit ihren Plätzen und den Programmpunkten darin.',
  loading: 'Wird geladen …',
  error: 'Das hat nicht funktioniert.',
  emptyPlan: 'Noch keine Räume.',
  noBookings: 'Hier ist noch nichts geplant.',
  seats: 'Plätze',
  signedUp: 'angemeldet',
  newRoom: 'Raum hinzufügen',
  nameLabel: 'Name',
  capacityLabel: 'Plätze',
  floorLabel: 'Etage',
  descriptionLabel: 'Beschreibung',
  save: 'Speichern',
  cancel: 'Abbrechen',
  edit: 'Bearbeiten',
  delete: 'Löschen',
  deleteNote: 'Das Löschen eines Raums nimmt seine Zuordnungen mit.',
  place: 'In diesen Raum legen',
  remove: 'Herausnehmen',
  chooseSession: 'Programmpunkt wählen',
  nothingToPlace: 'Jeder Programmpunkt ist schon in diesem Raum.',
  noSessions: 'Diese Veranstaltung hat noch keine Programmpunkte.',
  overbooked: 'Überbucht',
  doubleBooked: 'Doppelbelegung',
};

export function room(over: Partial<Room> = {}): Room {
  return {
    id: 'room-a',
    eventId: 'event-1',
    name: 'Saal A',
    capacity: 40,
    floor: null,
    description: null,
    ...over,
  };
}

export function session(over: Partial<PlannedSession> = {}): PlannedSession {
  return {
    programItemId: 'plenary',
    title: 'Opening plenary',
    startsAt: '2027-06-14T07:00:00.000Z',
    endsAt: '2027-06-14T08:00:00.000Z',
    // 07:00 UTC is 09:00 at the venue — the hour the plan has to draw (E69).
    timezone: 'Europe/Berlin',
    ...over,
  };
}

export function booking(over: Partial<RoomBooking> = {}): RoomBooking {
  return {
    ...session(),
    itemCapacity: null,
    signupCount: 0,
    warnings: [],
    ...over,
  };
}

export function planned(over: Partial<PlannedRoom> = {}): PlannedRoom {
  return { room: room(), bookings: [], warnings: [], ...over };
}

export function plan(
  rooms: readonly PlannedRoom[],
  sessions: readonly PlannedSession[] = rooms.flatMap((one) => one.bookings),
): RoomPlan {
  return { rooms, sessions };
}

export function publicRoom(over: Partial<PublicRoom> = {}): PublicRoom {
  return {
    id: 'room-a',
    name: 'Saal A',
    capacity: 40,
    floor: null,
    description: null,
    bookings: [],
    ...over,
  };
}

/**
 * The plug-in's routes, answering what the test put in and recording what was
 * written — no network, no host.
 */
export class FakeApi {
  answer: RoomPlan = plan([]);
  rooms: PublicRoom[] = [];
  reads = 0;
  /** The language of every public read, in order. */
  publicReads: string[] = [];
  /** When set, public reads wait until the test resolves them. */
  defer = false;
  pending: ((rooms: PublicRoom[]) => void)[] = [];
  created: { eventId: string; input: NewRoom }[] = [];
  updated: { roomId: string; changes: RoomChanges }[] = [];
  deleted: string[] = [];
  placed: { itemId: string; roomId: string }[] = [];
  removed: { itemId: string; roomId: string }[] = [];
  failWrite = false;
  failRead = false;

  plan(): Promise<RoomPlan> {
    this.reads += 1;
    if (this.failRead) return Promise.reject(new Error('boom'));
    return Promise.resolve(this.answer);
  }

  publicRooms(_eventId: string, locale: string): Promise<PublicRoom[]> {
    this.publicReads.push(locale);
    if (this.failRead) return Promise.reject(new Error('boom'));
    if (this.defer) {
      return new Promise((resolve) => this.pending.push(resolve));
    }
    return Promise.resolve(this.rooms);
  }

  createRoom(eventId: string, input: NewRoom): Promise<Room> {
    this.created.push({ eventId, input });
    return this.write(room({ id: 'room-new', ...input }));
  }

  updateRoom(roomId: string, changes: RoomChanges): Promise<Room> {
    this.updated.push({ roomId, changes });
    return this.write(room({ id: roomId }));
  }

  deleteRoom(roomId: string): Promise<void> {
    this.deleted.push(roomId);
    return this.write(undefined);
  }

  place(itemId: string, roomId: string): Promise<void> {
    this.placed.push({ itemId, roomId });
    return this.write(undefined);
  }

  remove(itemId: string, roomId: string): Promise<void> {
    this.removed.push({ itemId, roomId });
    return this.write(undefined);
  }

  private write<T>(answer: T): Promise<T> {
    return this.failWrite
      ? Promise.reject(new Error('boom'))
      : Promise.resolve(answer);
  }
}

/**
 * Lets the fetches a section starts finish, then redraws.
 *
 * A macrotask tick rather than `whenStable()`: without zone.js a fixture is
 * "stable" as soon as no change detection is pending, which says nothing about
 * a promise still in flight.
 */
export async function settle(fixture: {
  detectChanges(): void;
}): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

export const textOf = (fixture: { nativeElement: unknown }): string =>
  (fixture.nativeElement as HTMLElement).textContent ?? '';

export const buttons = (
  fixture: { nativeElement: unknown },
  label: string,
): HTMLButtonElement[] =>
  Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
  ).filter((button) => button.textContent?.trim() === label);

export const all = (
  fixture: { nativeElement: unknown },
  selector: string,
): HTMLElement[] =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector));

/** Submits a form the way a click on its button would. */
export function submit(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { cancelable: true }));
}
