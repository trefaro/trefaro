import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type {
  NewRoom,
  PlannedRoom,
  PlannedSession,
  Room,
  RoomBooking,
  RoomChanges,
  RoomPlan,
  RoomWarning,
} from '@trefaro/shared-models';
import { clock, when, word } from './plugin-words';
import { RoomPlanningApi } from './room-planning-api';

/** What the two room forms carry — the same four fields for adding and changing. */
interface RoomFields {
  readonly name: string;
  readonly capacity: number;
  readonly floor: string | null;
  readonly description: string | null;
}

/**
 * The room editor on the event dashboard (FR 3.11, E50).
 *
 * Mounted at the `event-dashboard` hook point AP 3 opened. Above it, in the
 * dashboard's own grid, the host draws a tile with this plug-in's label and
 * icon that jumps here (E59). Everything an organizer does with rooms happens
 * in this section: add one, rename it or change its seats, delete it, put a
 * session in and take one out.
 *
 * **What the plan does is show, not refuse** (E50). The two warnings — more
 * sign-ups than the rooms of a session have chairs, two sessions at the same
 * time in one room — stand at the session and at the room, in words, and no
 * button here is disabled because of them. A tool that refused a room would
 * be worked around, and then the truth would no longer be in the plan.
 *
 * **Every write is followed by a read.** The warnings are computed on the
 * server from numbers this bundle does not have (the sign-ups reach the
 * plug-in through the host's port and never the client), so an editor that
 * edited its own copy of the plan would show one the server does not have.
 * It is one click by one organizer; the round trip is affordable.
 *
 * Forms are read on submit rather than bound field by field: what the
 * organizer typed is the form's until the server has taken it, and a request
 * in flight disables the fieldset rather than emptying it.
 */
@Component({
  selector: 'trefaro-organizer-rooms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="panel__head">
        <h2 class="panel__title">{{ text().title }}</h2>
        <p class="note">{{ text().intro }}</p>
      </header>

      @if (failed()) {
        <p class="note note--error" role="alert">{{ text().error }}</p>
      }

      @if (loading()) {
        <p class="note">{{ text().loading }}</p>
      } @else {
        @if (rooms().length === 0) {
          <p class="note">{{ text().emptyPlan }}</p>
        } @else {
          <ul class="rooms">
            @for (planned of rooms(); track planned.room.id) {
              <li
                class="room"
                [class.room--warning]="planned.warnings.length > 0"
              >
                <div class="room__head">
                  <div>
                    <h3 class="room__name">{{ planned.room.name }}</h3>
                    <p class="room__meta">
                      @if (planned.room.floor) {
                        <span class="room__floor">{{
                          planned.room.floor
                        }}</span>
                        ·
                      }
                      <b>{{ planned.room.capacity }}</b> {{ text().seats }}
                    </p>
                    @if (planned.room.description) {
                      <p class="room__description">
                        {{ planned.room.description }}
                      </p>
                    }
                  </div>
                  @if (editing() !== planned.room.id) {
                    <p class="room__actions">
                      <button
                        class="action"
                        type="button"
                        [disabled]="busy()"
                        (click)="editing.set(planned.room.id)"
                      >
                        {{ text().edit }}
                      </button>
                      <button
                        class="action action--danger"
                        type="button"
                        [disabled]="busy()"
                        (click)="deleteRoom(planned.room)"
                      >
                        {{ text().delete }}
                      </button>
                    </p>
                  }
                </div>
                @if (planned.warnings.length > 0) {
                  <p class="room__warnings">
                    @for (warning of planned.warnings; track warning) {
                      <span class="warning warning--{{ warning }}">
                        {{ warningWord(warning) }}
                      </span>
                    }
                  </p>
                }
                @if (editing() === planned.room.id) {
                  <!-- Under the heading, not instead of it: the organizer
                       sees which room they are changing, and a locator that
                       found the room by its name keeps finding it. -->
                  <form
                    class="room-form"
                    (submit)="saveChanges($event, planned.room)"
                  >
                    <fieldset [disabled]="busy()">
                      <ng-container
                        *ngTemplateOutlet="
                          roomFields;
                          context: { room: planned.room }
                        "
                      />
                      <p class="form__actions">
                        <button class="action action--primary" type="submit">
                          {{ text().save }}
                        </button>
                        <button
                          class="action"
                          type="button"
                          (click)="editing.set(null)"
                        >
                          {{ text().cancel }}
                        </button>
                      </p>
                    </fieldset>
                  </form>
                }

                @if (planned.bookings.length === 0) {
                  <p class="note">{{ text().noBookings }}</p>
                } @else {
                  <ol class="bookings">
                    @for (
                      booking of planned.bookings;
                      track booking.programItemId
                    ) {
                      <li
                        class="booking"
                        [class.booking--warning]="booking.warnings.length > 0"
                      >
                        <span class="booking__time">{{ slot(booking) }}</span>
                        <span class="booking__title">{{ booking.title }}</span>
                        <span class="booking__signups">
                          <b>{{ booking.signupCount }}</b> {{ text().signedUp }}
                        </span>
                        <span class="booking__warnings">
                          @for (warning of booking.warnings; track warning) {
                            <span class="warning warning--{{ warning }}">
                              {{ warningWord(warning) }}
                            </span>
                          }
                        </span>
                        <button
                          class="action action--small"
                          type="button"
                          [disabled]="busy()"
                          (click)="remove(booking, planned.room)"
                        >
                          {{ text().remove }}
                        </button>
                      </li>
                    }
                  </ol>
                }

                <form class="place-form" (submit)="place($event, planned.room)">
                  @if (sessions().length === 0) {
                    <p class="note">{{ text().noSessions }}</p>
                  } @else if (candidates(planned).length === 0) {
                    <p class="note">{{ text().nothingToPlace }}</p>
                  } @else {
                    <fieldset [disabled]="busy()">
                      <label class="place-form__label">
                        <span>{{ text().chooseSession }}</span>
                        <select name="session">
                          @for (
                            session of candidates(planned);
                            track session.programItemId
                          ) {
                            <option [value]="session.programItemId">
                              {{ slot(session) }} · {{ session.title }}
                            </option>
                          }
                        </select>
                      </label>
                      <button class="action action--small" type="submit">
                        {{ text().place }}
                      </button>
                    </fieldset>
                  }
                </form>
              </li>
            }
          </ul>
        }

        <p class="note note--hint">{{ text().deleteNote }}</p>

        @if (adding()) {
          <form class="room-form room-form--new" (submit)="create($event)">
            <fieldset [disabled]="busy()">
              <ng-container
                *ngTemplateOutlet="roomFields; context: { room: null }"
              />
              <p class="form__actions">
                <button class="action action--primary" type="submit">
                  {{ text().save }}
                </button>
                <button
                  class="action"
                  type="button"
                  (click)="adding.set(false)"
                >
                  {{ text().cancel }}
                </button>
              </p>
            </fieldset>
          </form>
        } @else {
          <button
            class="action action--primary new-room"
            type="button"
            [disabled]="busy()"
            (click)="adding.set(true)"
          >
            {{ text().newRoom }}
          </button>
        }
      }
    </section>

    <ng-template #roomFields let-room="room">
      <div class="fields">
        <label>
          <span>{{ text().nameLabel }}</span>
          <input
            name="name"
            type="text"
            required
            maxlength="128"
            [value]="room?.name ?? ''"
          />
        </label>
        <label>
          <span>{{ text().capacityLabel }}</span>
          <input
            name="capacity"
            type="number"
            required
            min="1"
            max="100000"
            [value]="room?.capacity ?? ''"
          />
        </label>
        <label>
          <span>{{ text().floorLabel }}</span>
          <input
            name="floor"
            type="text"
            maxlength="64"
            [value]="room?.floor ?? ''"
          />
        </label>
        <label class="fields__wide">
          <span>{{ text().descriptionLabel }}</span>
          <textarea
            name="description"
            rows="2"
            maxlength="2000"
            [value]="room?.description ?? ''"
          ></textarea>
        </label>
      </div>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
      font-family: var(--trefaro-font-family, system-ui, sans-serif);
    }

    .panel {
      border: 1px solid color-mix(in oklab, currentColor 15%, transparent);
      border-radius: 0.6rem;
      padding: 1rem 1.1rem;
    }

    .panel__head {
      margin-bottom: 0.8rem;
    }

    .panel__title {
      margin: 0 0 0.2rem;
      font-size: 1.05rem;
    }

    .note {
      margin: 0 0 0.6rem;
      font-size: 0.9rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .note--error {
      color: inherit;
      font-weight: 600;
    }

    .note--hint {
      margin-top: 0.8rem;
      font-size: 0.82rem;
    }

    .rooms,
    .bookings {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .rooms {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .room {
      padding: 0.6rem 0.8rem;
      border: 1px solid color-mix(in oklab, currentColor 12%, transparent);
      border-radius: 0.5rem;
    }

    .room--warning {
      border-color: var(--trefaro-color-accent, #c2410c);
    }

    .room__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.8rem;
    }

    .room__name {
      margin: 0;
      font-size: 1rem;
    }

    .room__meta {
      margin: 0.1rem 0 0.3rem;
      font-size: 0.85rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .room__description {
      margin: 0 0 0.4rem;
      font-size: 0.9rem;
    }

    .room__actions,
    .form__actions {
      display: flex;
      gap: 0.4rem;
      margin: 0;
      flex-shrink: 0;
    }

    .room__warnings {
      margin: 0 0 0.4rem;
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .warning {
      display: inline-block;
      padding: 0.05rem 0.5rem;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
      background: var(--trefaro-color-accent, #c2410c);
      color: var(--trefaro-color-on-accent, #fff);
    }

    .bookings {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      margin: 0.4rem 0 0.6rem;
    }

    .booking {
      display: grid;
      grid-template-columns: auto 1fr auto auto auto;
      gap: 0.6rem;
      align-items: center;
      font-size: 0.9rem;
    }

    .booking__time {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      color: var(--trefaro-color-primary, #1f6f5c);
    }

    .booking__signups {
      white-space: nowrap;
      font-size: 0.85rem;
    }

    .booking__warnings {
      display: flex;
      gap: 0.3rem;
    }

    .place-form fieldset,
    .room-form fieldset {
      border: none;
      margin: 0;
      padding: 0;
      min-width: 0;
    }

    .place-form fieldset {
      display: flex;
      gap: 0.5rem;
      align-items: flex-end;
      flex-wrap: wrap;
    }

    .place-form__label {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      font-size: 0.82rem;
      flex: 1 1 14rem;
    }

    .room-form {
      margin: 0.4rem 0 0.6rem;
    }

    .fields {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 0.6rem;
      margin-bottom: 0.6rem;
    }

    .fields label {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      font-size: 0.82rem;
    }

    .fields__wide {
      grid-column: 1 / -1;
    }

    input,
    select,
    textarea {
      font: inherit;
      padding: 0.35rem 0.5rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
    }

    .action {
      font: inherit;
      cursor: pointer;
      padding: 0.35rem 0.7rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
    }

    .action--primary {
      border-color: transparent;
      background: var(--trefaro-color-primary, #1f6f5c);
      color: var(--trefaro-color-on-primary, #fff);
    }

    .action--danger {
      border-color: var(--trefaro-color-accent, #c2410c);
    }

    .action--small {
      padding: 0.2rem 0.5rem;
      font-size: 0.85rem;
    }

    .action[disabled] {
      cursor: progress;
      opacity: 0.6;
    }

    @media (max-width: 40rem) {
      .booking {
        grid-template-columns: 1fr 1fr;
      }

      .fields {
        grid-template-columns: 1fr;
      }
    }
  `,
  imports: [NgTemplateOutlet],
})
export class OrganizerRooms {
  readonly eventId = input<string | null>(null);
  readonly locale = input<string>('en');
  readonly strings = input<Readonly<Record<string, string>>>({});

  private readonly api = inject(RoomPlanningApi);

  private readonly plan = signal<RoomPlan>({ rooms: [], sessions: [] });

  protected readonly rooms = computed(() => this.plan().rooms);
  protected readonly sessions = computed(() => this.plan().sessions);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  /** A write in flight: the forms are disabled, not emptied. */
  protected readonly busy = signal(false);
  protected readonly adding = signal(false);
  /** The room whose form is open, or none. */
  protected readonly editing = signal<string | null>(null);

  protected readonly text = computed(() => {
    const strings = this.strings();
    const say = (key: string): string => word(strings, key);
    return {
      title: say('title'),
      intro: say('intro'),
      loading: say('loading'),
      error: say('error'),
      emptyPlan: say('emptyPlan'),
      noBookings: say('noBookings'),
      seats: say('seats'),
      signedUp: say('signedUp'),
      newRoom: say('newRoom'),
      nameLabel: say('nameLabel'),
      capacityLabel: say('capacityLabel'),
      floorLabel: say('floorLabel'),
      descriptionLabel: say('descriptionLabel'),
      save: say('save'),
      cancel: say('cancel'),
      edit: say('edit'),
      delete: say('delete'),
      deleteNote: say('deleteNote'),
      place: say('place'),
      remove: say('remove'),
      chooseSession: say('chooseSession'),
      nothingToPlace: say('nothingToPlace'),
      noSessions: say('noSessions'),
      overbooked: say('overbooked'),
      doubleBooked: say('doubleBooked'),
    };
  });

  constructor() {
    effect(() => {
      const eventId = this.eventId();
      this.plan.set({ rooms: [], sessions: [] });
      this.editing.set(null);
      this.adding.set(false);
      if (!eventId) return;
      void this.load(eventId);
    });
  }

  protected warningWord(warning: RoomWarning): string {
    return warning === 'overbooked'
      ? this.text().overbooked
      : this.text().doubleBooked;
  }

  protected slot(session: PlannedSession): string {
    // The venue's clock, from the session itself (E8, E69) — an organizer
    // planning from another country sees the hours the event runs at.
    return (
      `${when(this.locale(), session.startsAt, session.timezone)}` +
      `–${clock(this.locale(), session.endsAt, session.timezone)}`
    );
  }

  /** The event's sessions that are not in this room yet — what it can take. */
  protected candidates(planned: PlannedRoom): readonly PlannedSession[] {
    const inRoom = new Set(
      planned.bookings.map((booking) => booking.programItemId),
    );
    return this.sessions().filter(
      (session) => !inRoom.has(session.programItemId),
    );
  }

  protected create(event: Event): void {
    event.preventDefault();
    const eventId = this.eventId();
    if (!eventId) return;
    const fields = readRoomFields(event.target as HTMLFormElement);
    void this.write(
      () => this.api.createRoom(eventId, fields satisfies NewRoom),
      () => this.adding.set(false),
    );
  }

  protected saveChanges(event: Event, room: Room): void {
    event.preventDefault();
    const fields = readRoomFields(event.target as HTMLFormElement);
    void this.write(
      () => this.api.updateRoom(room.id, fields satisfies RoomChanges),
      () => this.editing.set(null),
    );
  }

  protected deleteRoom(room: Room): void {
    void this.write(() => this.api.deleteRoom(room.id));
  }

  protected place(event: Event, room: Room): void {
    event.preventDefault();
    const picked = new FormData(event.target as HTMLFormElement).get('session');
    if (typeof picked !== 'string' || picked === '') return;
    void this.write(() => this.api.place(picked, room.id));
  }

  protected remove(booking: RoomBooking, room: Room): void {
    void this.write(() => this.api.remove(booking.programItemId, room.id));
  }

  /**
   * One write, then the plan is read again.
   *
   * `afterwards` runs only when the write went through: a form whose write
   * failed stays open with what was typed, because nothing was written and
   * nothing may look written.
   */
  private async write(
    action: () => Promise<unknown>,
    afterwards: () => void = () => undefined,
  ): Promise<void> {
    const eventId = this.eventId();
    if (!eventId || this.busy()) return;
    this.busy.set(true);
    this.failed.set(false);
    try {
      await action();
      afterwards();
      await this.load(eventId);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  private async load(eventId: string): Promise<void> {
    try {
      this.plan.set(await this.api.plan(eventId));
      this.failed.set(false);
    } catch {
      // Including a 401: the organizer's session expired while the dashboard
      // stood open. Sending them to the login is the host's business.
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}

/**
 * The four fields of a room form, as the server wants them.
 *
 * An empty optional field is `null`, not an empty string: `null` is what
 * clears a floor on a change, and an empty string would be refused by the
 * length rule the DTO carries.
 */
function readRoomFields(form: HTMLFormElement): RoomFields {
  const data = new FormData(form);
  const text = (name: string): string => String(data.get(name) ?? '');
  const optional = (name: string): string | null => {
    const value = text(name).trim();
    return value === '' ? null : value;
  };
  return {
    name: text('name'),
    capacity: Number(text('capacity')),
    floor: optional('floor'),
    description: optional('description'),
  };
}
