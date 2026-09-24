import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type { PlannedSession, PublicRoom } from '@trefaro/shared-models';
import { clock, when, word } from './plugin-words';
import { RoomPlanningApi } from './room-planning-api';

/**
 * The room plan as a participant reads it (FR 3.6, E58).
 *
 * Mounted at the `event-detail` hook point, for everybody: a room name is not
 * a person, so unlike the proposals and the forum this section needs no
 * session and shows no invitation to log in — the reasoned counter-example
 * (F192). Every room with its seats, its floor and what happens in it, in
 * clock order.
 *
 * **It asks again when the language changes** (E56): the titles are
 * translated on the server, so `locale` is part of the request and a switch is
 * a new read. And it **keeps the answer it asked for last** — two reads are in
 * flight the moment somebody switches before the first has landed, and the
 * network does not answer in order (AP 5's lesson on the landing page).
 *
 * **The times are the venue's clock** (E8, E69). Every session carries the
 * event's zone since plug-in API 1.3.0, and this section draws it — so a plan
 * read from Toronto says the same hour as the programme above it on the same
 * page. Until then a plug-in was handed no zone at all, and the two disagreed
 * by the offset between the reader and the venue.
 */
@Component({
  selector: 'trefaro-participant-rooms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <h2 class="panel__title">{{ text().title }}</h2>

      @if (failed()) {
        <p class="note note--error" role="alert">{{ text().error }}</p>
      }

      @if (loading()) {
        <p class="note">{{ text().loading }}</p>
      } @else if (rooms().length === 0) {
        <p class="note">{{ text().emptyPlan }}</p>
      } @else {
        <ul class="rooms">
          @for (room of rooms(); track room.id) {
            <li class="room">
              <h3 class="room__name">{{ room.name }}</h3>
              <p class="room__meta">
                @if (room.floor) {
                  <span class="room__floor">{{ room.floor }}</span>
                  ·
                }
                <b>{{ room.capacity }}</b> {{ text().seats }}
              </p>
              @if (room.description) {
                <p class="room__description">{{ room.description }}</p>
              }

              @if (room.bookings.length === 0) {
                <p class="note">{{ text().noBookings }}</p>
              } @else {
                <ol class="bookings">
                  @for (booking of room.bookings; track booking.programItemId) {
                    <li class="booking">
                      <span class="booking__time">{{ slot(booking) }}</span>
                      <span class="booking__title">{{ booking.title }}</span>
                    </li>
                  }
                </ol>
              }
            </li>
          }
        </ul>
      }
    </section>
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

    .panel__title {
      margin: 0 0 0.8rem;
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
      padding-block-end: 1rem;
      border-block-end: 1px solid
        color-mix(in oklab, currentColor 12%, transparent);
    }

    .room:last-child {
      border-block-end: none;
      padding-block-end: 0;
    }

    .room__name {
      margin: 0;
      font-size: 1rem;
    }

    .room__meta {
      margin: 0.1rem 0 0.4rem;
      font-size: 0.85rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
    }

    .room__description {
      margin: 0 0 0.5rem;
      font-size: 0.9rem;
    }

    .bookings {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .booking {
      display: grid;
      grid-template-columns: minmax(0, auto) 1fr;
      gap: 0.6rem;
      align-items: baseline;
      font-size: 0.9rem;
    }

    .booking__time {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      color: var(--trefaro-color-primary, #1f6f5c);
    }

    @media (max-width: 30rem) {
      .booking {
        grid-template-columns: 1fr;
        gap: 0.1rem;
      }
    }
  `,
})
export class ParticipantRooms {
  readonly eventId = input<string | null>(null);
  readonly locale = input<string>('en');
  readonly strings = input<Readonly<Record<string, string>>>({});

  private readonly api = inject(RoomPlanningApi);

  private readonly loaded = signal<readonly PublicRoom[]>([]);
  /** Counts the reads, so a late answer to an earlier one is dropped. */
  private loadSequence = 0;

  protected readonly rooms = this.loaded.asReadonly();
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly text = computed(() => {
    const strings = this.strings();
    const say = (key: string): string => word(strings, key);
    return {
      title: say('title'),
      loading: say('loading'),
      error: say('error'),
      emptyPlan: say('emptyPlan'),
      noBookings: say('noBookings'),
      seats: say('seats'),
    };
  });

  constructor() {
    effect(() => {
      const eventId = this.eventId();
      // Read here so the effect runs again on a switch: the titles are the
      // server's translations, and a redraw alone would keep the old ones.
      const locale = this.locale();
      if (!eventId) return;
      void this.load(eventId, locale);
    });
  }

  protected slot(booking: PlannedSession): string {
    return (
      `${when(this.locale(), booking.startsAt, booking.timezone)}` +
      `–${clock(this.locale(), booking.endsAt, booking.timezone)}`
    );
  }

  private async load(eventId: string, locale: string): Promise<void> {
    const run = ++this.loadSequence;
    this.loading.set(true);
    try {
      const rooms = await this.api.publicRooms(eventId, locale);
      if (run !== this.loadSequence) return;
      this.loaded.set(rooms);
      this.failed.set(false);
    } catch {
      if (run !== this.loadSequence) return;
      this.failed.set(true);
    } finally {
      if (run === this.loadSequence) this.loading.set(false);
    }
  }
}
