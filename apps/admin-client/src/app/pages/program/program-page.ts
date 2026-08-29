import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type {
  OrganizerEvent,
  ProgramDay,
  ProgramItem,
  ProgramItemLoad,
  PublicProgramItem,
} from '@trefaro/shared-models';
import {
  MAX_PROGRAM_DESCRIPTION_LENGTH,
  MAX_PROGRAM_ITEMS,
  MAX_PROGRAM_ITEM_CAPACITY,
  MAX_PROGRAM_SPEAKER_LENGTH,
  MAX_PROGRAM_TITLE_LENGTH,
  formatEventPeriod,
  formatInstant,
  formatProgramTime,
  groupProgramByDay,
  instantToWallClock,
  isProgramItemFull,
  isWithinPeriod,
  overlappingProgramItems,
  seatsLeft,
  wallClockToInstant,
} from '@trefaro/shared-models';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { ProgramAdminService } from '../../features/program/program-admin.service';

/** What a card's inputs hold until they are saved. */
interface ItemDraft {
  title: string;
  speaker: string;
  description: string;
  /** Wall-clock values, read in the event's zone — never the organizer's. */
  startsAt: string;
  endsAt: string;
  registrationEnabled: boolean;
  /** As the number input holds it: empty means "as many as come". */
  capacity: string;
}

/**
 * Planning the programme of one event (FR 3.7, UC 04).
 *
 * Written in the event's own time zone throughout (E8), including the inputs: an
 * organizer in Cologne planning a conference in Nairobi types the times the
 * participants will read, not the ones their own laptop shows. The zone is named
 * above the form so that is not a guess.
 *
 * Two things this view shows rather than prevents (F41):
 *
 * 1. **Overlaps.** Two sessions at the same time are what a two-track day is.
 *    Marked, because only a person can tell a parallel track from the keynote
 *    and the workshop both having been put at 09:00 by mistake.
 * 2. **Items the event left behind.** Shifting an event by a day does not move
 *    its programme. Refusing the shift would be a dead end — the way out is to
 *    move the sessions, and that needs them to be visible and editable.
 *
 * There is no "move up": the clock is the order (F40). Changing a session's time
 * is what moves it, which is also the only thing that could have been meant.
 *
 * Sign-up (FR 3.10) is per session and off by default: most sessions are simply
 * attended, and only some — a workshop with twelve chairs — ask who is coming.
 * The seat field appears with the switch, because a limit without sign-up is
 * refused rather than ignored. Who signed up is one request per session, made
 * when an organizer opens that one list.
 */
@Component({
  selector: 'trefaro-program-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  template: `
    <header class="head">
      <div>
        <h1>{{ 'admin.program.title' | transloco }}</h1>
        <p class="meta">
          @if (event(); as item) {
            <a [routerLink]="['/series', seriesId(), 'events', item.id]">
              {{ item.name }}
            </a>
            <span>
              {{ 'admin.program.runsIn' | transloco: { period: when() } }}
            </span>
          }
        </p>
      </div>
      <a
        class="back"
        [routerLink]="['/series', seriesId(), 'events', eventId()]"
      >
        {{ 'admin.events.back' | transloco }}
      </a>
    </header>

    @if (error(); as problem) {
      <p class="error" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="error__detail">{{ detail }}</span>
        }
      </p>
    }

    @if (clashing().size > 0) {
      <p class="hint" role="status">
        {{ 'admin.program.clashHint' | transloco: { count: clashing().size } }}
      </p>
    }

    @if (stranded().size > 0) {
      <p class="hint" role="status">
        {{
          'admin.program.strandedHint' | transloco: { count: stranded().size }
        }}
      </p>
    }

    <section aria-labelledby="program-heading">
      <h2 id="program-heading">
        {{ 'admin.program.sessions' | transloco }}
      </h2>

      @if (items().length === 0) {
        <p class="meta">
          {{
            (loading() ? 'common.loading' : 'admin.program.empty') | transloco
          }}
        </p>
      }

      @for (day of days(); track day.key) {
        <h3 class="day">{{ day.label }}</h3>
        <ol class="items">
          @for (item of day.items; track item.id) {
            <li
              class="item"
              [class.item--clash]="clashing().has(item.id)"
              [class.item--stranded]="stranded().has(item.id)"
            >
              <div class="item__head">
                <span class="clock">{{ clock(item) }}</span>
                @if (clashing().has(item.id)) {
                  <span class="badge">
                    {{ 'admin.program.badgeClash' | transloco }}
                  </span>
                }
                @if (stranded().has(item.id)) {
                  <span class="badge badge--warn">
                    {{ 'admin.program.badgeStranded' | transloco }}
                  </span>
                }
              </div>

              <label>
                <span>{{ 'admin.program.topic' | transloco }}</span>
                <input
                  [attr.maxlength]="maxTitleLength"
                  [value]="draft(item.id).title"
                  (input)="edit(item.id, { title: value($event) })"
                />
              </label>

              <label>
                <span>{{ 'admin.program.speaker' | transloco }}</span>
                <input
                  [attr.maxlength]="maxSpeakerLength"
                  [placeholder]="'admin.program.optional' | transloco"
                  [value]="draft(item.id).speaker"
                  (input)="edit(item.id, { speaker: value($event) })"
                />
              </label>

              <label>
                <span>{{ 'admin.program.description' | transloco }}</span>
                <textarea
                  rows="3"
                  [attr.maxlength]="maxDescriptionLength"
                  [placeholder]="
                    'admin.program.descriptionPlaceholder' | transloco
                  "
                  [value]="draft(item.id).description"
                  (input)="edit(item.id, { description: value($event) })"
                ></textarea>
              </label>

              <div class="period">
                <label>
                  <span>{{ 'admin.events.startsAt' | transloco }}</span>
                  <input
                    type="datetime-local"
                    [value]="draft(item.id).startsAt"
                    (input)="edit(item.id, { startsAt: value($event) })"
                  />
                </label>
                <label>
                  <span>{{ 'admin.events.endsAt' | transloco }}</span>
                  <input
                    type="datetime-local"
                    [value]="draft(item.id).endsAt"
                    (input)="edit(item.id, { endsAt: value($event) })"
                  />
                </label>
              </div>

              <div class="signup">
                <label class="signup__switch">
                  <input
                    type="checkbox"
                    [checked]="draft(item.id).registrationEnabled"
                    (change)="toggleRegistration(item.id, $event)"
                  />
                  <span>{{ 'admin.program.askWhoIsComing' | transloco }}</span>
                </label>

                @if (draft(item.id).registrationEnabled) {
                  <label class="signup__seats">
                    <span>{{ 'admin.program.seats' | transloco }}</span>
                    <input
                      type="number"
                      min="1"
                      [attr.max]="maxCapacity"
                      [placeholder]="'admin.program.noLimit' | transloco"
                      [value]="draft(item.id).capacity"
                      (input)="edit(item.id, { capacity: value($event) })"
                    />
                  </label>
                }

                @if (item.registrationEnabled) {
                  <p class="signup__load">
                    <span>{{ takeUp(item) }}</span>
                    @if (sessionFull(item)) {
                      <span class="badge badge--warn">
                        {{ 'admin.program.full' | transloco }}
                      </span>
                    }
                  </p>
                  <button
                    type="button"
                    class="signup__who"
                    (click)="toggleSignups(item)"
                  >
                    {{
                      (openSignups() === item.id
                        ? 'admin.program.hideList'
                        : 'admin.program.whoSignedUp'
                      ) | transloco
                    }}
                  </button>

                  @if (openSignups() === item.id) {
                    @if (signups(); as list) {
                      @if (list.participants.length === 0) {
                        <p class="meta">
                          {{ 'admin.program.nobodySignedUp' | transloco }}
                        </p>
                      } @else {
                        <table class="who">
                          <thead>
                            <tr>
                              <th scope="col">
                                {{ 'admin.program.colName' | transloco }}
                              </th>
                              <th scope="col">
                                {{ 'admin.program.colEmail' | transloco }}
                              </th>
                              <th scope="col">
                                {{ 'admin.program.colSignedUp' | transloco }}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (
                              person of list.participants;
                              track person.registrationId
                            ) {
                              <tr>
                                <td>
                                  {{ person.firstName }} {{ person.lastName }}
                                </td>
                                <td>{{ person.email }}</td>
                                <td>{{ signedUp(person.signedUpAt) }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      }
                    } @else {
                      <p class="meta">{{ 'common.loading' | transloco }}</p>
                    }
                  }
                }
              </div>

              <div class="item__actions">
                <button
                  type="button"
                  [disabled]="busy() || !changed(item)"
                  (click)="save(item)"
                >
                  {{ 'admin.common.save' | transloco }}
                </button>
                <button
                  type="button"
                  class="danger"
                  [disabled]="busy()"
                  (click)="remove(item)"
                >
                  {{ 'admin.common.delete' | transloco }}
                </button>
              </div>
            </li>
          }
        </ol>
      }
    </section>

    <section aria-labelledby="add-heading">
      <h2 id="add-heading">{{ 'admin.program.add' | transloco }}</h2>
      @if (full()) {
        <p class="meta">
          {{ 'admin.program.atMost' | transloco: { count: maxItems } }}
        </p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="add()" novalidate>
          <!-- Closed while a request is in flight, and until the event is known:
               the form clears itself once a session is saved, and a topic typed
               in that window would be wiped by the reset. The times also have to
               be read in the event's zone, which is not known before it loads. -->
          <fieldset [disabled]="busy() || loading()">
            <label>
              <span>{{ 'admin.program.topic' | transloco }}</span>
              <input
                formControlName="title"
                [attr.maxlength]="maxTitleLength"
                [placeholder]="'admin.program.topicPlaceholder' | transloco"
              />
            </label>

            <label>
              <span>{{ 'admin.program.speaker' | transloco }}</span>
              <input
                formControlName="speaker"
                [attr.maxlength]="maxSpeakerLength"
                [placeholder]="'admin.program.optional' | transloco"
              />
            </label>

            <label>
              <span>{{ 'admin.program.description' | transloco }}</span>
              <textarea
                formControlName="description"
                rows="3"
                [attr.maxlength]="maxDescriptionLength"
                [placeholder]="
                  'admin.program.descriptionPlaceholder' | transloco
                "
              ></textarea>
            </label>

            <div class="period">
              <label>
                <span>{{ 'admin.events.startsAt' | transloco }}</span>
                <input formControlName="startsAt" type="datetime-local" />
              </label>
              <label>
                <span>{{ 'admin.events.endsAt' | transloco }}</span>
                <input formControlName="endsAt" type="datetime-local" />
              </label>
            </div>

            <div class="signup">
              <label class="signup__switch">
                <input type="checkbox" formControlName="registrationEnabled" />
                <span>{{ 'admin.program.askWhoIsComing' | transloco }}</span>
              </label>
              @if (form.controls.registrationEnabled.value) {
                <label class="signup__seats">
                  <span>{{ 'admin.program.seats' | transloco }}</span>
                  <input
                    formControlName="capacity"
                    type="number"
                    min="1"
                    [attr.max]="maxCapacity"
                    [placeholder]="'admin.program.noLimit' | transloco"
                  />
                </label>
              }
            </div>

            <button type="submit">
              {{ 'admin.program.addSubmit' | transloco }}
            </button>
          </fieldset>
        </form>
      }
    </section>
  `,
  styles: `
    .head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .meta {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      color: color-mix(in oklab, currentColor 70%, transparent);
      font-size: 0.9rem;
    }

    .error,
    .hint {
      padding: 0.6rem 0.8rem;
      border-radius: 0.4rem;
      background: color-mix(in oklab, currentColor 8%, transparent);
      max-inline-size: 40rem;
    }

    .error {
      color: var(--trefaro-color-primary-strong);
    }

    section {
      margin-block-start: 2rem;
    }

    .day {
      margin-block: 1.4rem 0.6rem;
      font-size: 1rem;
      color: color-mix(in oklab, currentColor 75%, transparent);
    }

    .items {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .item {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 1rem;
      border: 1px solid color-mix(in oklab, currentColor 20%, transparent);
      border-radius: 0.5rem;
      max-inline-size: 40rem;
    }

    .item--clash {
      border-color: color-mix(
        in oklab,
        var(--trefaro-color-accent) 60%,
        transparent
      );
    }

    .item--stranded {
      border-color: var(--trefaro-color-primary-strong);
    }

    .item__head {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .clock {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .badge {
      padding: 0.1rem 0.5rem;
      border-radius: 1rem;
      background: color-mix(
        in oklab,
        var(--trefaro-color-accent) 25%,
        transparent
      );
      font-size: 0.8rem;
      font-weight: 600;
    }

    .badge--warn {
      background: color-mix(
        in oklab,
        var(--trefaro-color-primary-strong) 20%,
        transparent
      );
    }

    .period {
      display: flex;
      gap: 0.8rem;
      flex-wrap: wrap;
    }

    form {
      max-inline-size: 40rem;
    }

    /* Purely a grouping element here — the box it would draw by default is not
       a section of the page, it is a request in flight. */
    fieldset {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      margin: 0;
      padding: 0;
      border: 0;
    }

    fieldset:disabled {
      opacity: 0.6;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    label > span {
      font-weight: 600;
    }

    input,
    textarea {
      padding: 0.5rem;
      border: 1px solid color-mix(in oklab, currentColor 35%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    .signup {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      padding-block-start: 0.6rem;
      border-block-start: 1px solid
        color-mix(in oklab, currentColor 15%, transparent);
    }

    .signup__switch {
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
    }

    .signup__switch > span {
      font-weight: 600;
    }

    .signup__seats {
      max-inline-size: 9rem;
    }

    .signup__load {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      font-size: 0.9rem;
      color: color-mix(in oklab, currentColor 75%, transparent);
    }

    .signup__who {
      align-self: start;
    }

    .who {
      border-collapse: collapse;
      inline-size: 100%;
      font-size: 0.9rem;
    }

    .who th,
    .who td {
      padding: 0.3rem 0.5rem 0.3rem 0;
      text-align: start;
      border-block-end: 1px solid
        color-mix(in oklab, currentColor 12%, transparent);
    }

    .item__actions {
      display: flex;
      gap: 0.5rem;
    }

    button {
      align-self: start;
      padding: 0.45rem 0.9rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
      font: inherit;
    }

    button[type='submit'] {
      border: 0;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font-weight: 600;
    }

    button:disabled {
      opacity: 0.5;
    }

    .danger {
      color: var(--trefaro-color-primary-strong);
    }
  `,
})
export class ProgramPage {
  /** Both bound from the route by `withComponentInputBinding()`. */
  readonly seriesId = input.required<string>();
  readonly eventId = input.required<string>();

  protected readonly maxTitleLength = MAX_PROGRAM_TITLE_LENGTH;
  protected readonly maxSpeakerLength = MAX_PROGRAM_SPEAKER_LENGTH;
  protected readonly maxDescriptionLength = MAX_PROGRAM_DESCRIPTION_LENGTH;
  protected readonly maxItems = MAX_PROGRAM_ITEMS;
  protected readonly maxCapacity = MAX_PROGRAM_ITEM_CAPACITY;

  private readonly program = inject(ProgramAdminService);
  private readonly events = inject(EventsAdminService);
  private readonly i18n = inject(TranslationService);

  protected readonly event = signal<OrganizerEvent | null>(null);
  protected readonly items = signal<readonly ProgramItem[]>([]);
  protected readonly error = signal<Problem | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);

  /** What the card inputs hold, keyed by item id, until Save is pressed. */
  private readonly drafts = signal<Record<string, ItemDraft>>({});

  /** Which session's attendee list is open, and what it holds (FR 3.10). */
  protected readonly openSignups = signal<string | null>(null);
  protected readonly signups = signal<ProgramItemLoad | null>(null);

  protected readonly full = computed(
    () => this.items().length >= MAX_PROGRAM_ITEMS,
  );

  /** The programme grouped into days as they are counted at the venue (E8). */
  protected readonly days = computed<readonly ProgramDay<ProgramItem>[]>(() => {
    const event = this.event();
    return event
      ? groupProgramByDay(this.items(), event.timezone, this.locale())
      : [];
  });

  protected readonly clashing = computed(() =>
    overlappingProgramItems(this.items()),
  );

  /** Items an event's own change left outside its period (F41). */
  protected readonly stranded = computed(() => {
    const event = this.event();
    if (!event) return new Set<string>();
    return new Set(
      this.items()
        .filter((item) => !isWithinPeriod(item, event))
        .map((item) => item.id),
    );
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    title: ['', Validators.required],
    speaker: [''],
    description: [''],
    startsAt: ['', Validators.required],
    endsAt: ['', Validators.required],
    registrationEnabled: [false],
    /** A string, as the number input holds it: empty means "as many as come". */
    capacity: [''],
  });

  constructor() {
    // One effect, not two: the cards hold wall-clock times in the event's zone,
    // so the event has to be loaded before the items are turned into drafts.
    effect(() => {
      void this.load(this.eventId());
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected when(): string {
    const event = this.event();
    return event ? formatEventPeriod(event, this.locale()) : '';
  }

  protected clock(item: PublicProgramItem): string {
    const event = this.event();
    return event ? formatProgramTime(item, event.timezone, this.locale()) : '';
  }

  protected draft(id: string): ItemDraft {
    return this.drafts()[id] ?? blankDraft();
  }

  /**
   * Switching sign-up off clears the seats with it.
   *
   * The server does the same thing to the stored row, and for the same reason: a
   * limit on a session that does not ask who is coming is a limit nothing
   * enforces. Doing it here too means the card shows what will be saved.
   */
  protected toggleRegistration(id: string, event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    this.edit(id, {
      registrationEnabled: enabled,
      capacity: enabled ? this.draft(id).capacity : '',
    });
  }

  /** "7 of 12 seats taken", or the count alone where there is no limit. */
  protected takeUp(item: ProgramItem): string {
    const left = seatsLeft(item);
    if (left === null) {
      return this.i18n.translate('admin.program.takeUpNoLimit', {
        count: item.signupCount,
      });
    }
    return this.i18n.translate('admin.program.takeUpLimit', {
      count: item.signupCount,
      capacity: item.capacity,
      left,
    });
  }

  /** Named for the session, not the programme: `full()` above is the item cap. */
  protected sessionFull(item: ProgramItem): boolean {
    return isProgramItemFull(item);
  }

  /** In the event's zone (E8), like every other time on this page. */
  protected signedUp(instant: string): string {
    const event = this.event();
    return event ? formatInstant(instant, event.timezone, this.locale()) : '';
  }

  /**
   * Opens or closes one session's attendee list.
   *
   * One request per session and only on demand: the programme carries the
   * numbers, and loading every attendee of every session to show a count would
   * break the load rule of FR 3.3 in a new place.
   */
  protected async toggleSignups(item: ProgramItem): Promise<void> {
    if (this.openSignups() === item.id) {
      this.openSignups.set(null);
      return;
    }

    this.openSignups.set(item.id);
    this.signups.set(null);
    try {
      const load = await this.program.signups(item.id);
      // Still the session the organizer asked about: a second click while this
      // was in flight must not fill the new panel with the old list.
      if (this.openSignups() === item.id) this.signups.set(load);
    } catch (error: unknown) {
      this.openSignups.set(null);
      this.report(error, 'admin.program.errorSignups');
    }
  }

  protected edit(id: string, patch: Partial<ItemDraft>): void {
    this.drafts.update((drafts) => ({
      ...drafts,
      [id]: { ...this.draft(id), ...patch },
    }));
  }

  /** Whether this card differs from what the server holds. */
  protected changed(item: ProgramItem): boolean {
    const draft = this.draft(item.id);
    const saved = this.draftOf(item);
    return (
      draft.title !== saved.title ||
      draft.speaker !== saved.speaker ||
      draft.description !== saved.description ||
      draft.startsAt !== saved.startsAt ||
      draft.endsAt !== saved.endsAt ||
      draft.registrationEnabled !== saved.registrationEnabled ||
      draft.capacity !== saved.capacity
    );
  }

  protected async add(): Promise<void> {
    const zone = this.event()?.timezone;
    if (this.form.invalid || this.busy() || !zone) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    await this.change(async () => {
      await this.program.create(this.eventId(), {
        title: raw.title,
        speaker: raw.speaker.trim() || null,
        description: raw.description.trim() || null,
        // Read in the event's zone, not the organizer's browser's (E8).
        startsAt: wallClockToInstant(raw.startsAt, zone),
        endsAt: wallClockToInstant(raw.endsAt, zone),
        registrationEnabled: raw.registrationEnabled,
        capacity: capacityOf(raw.capacity, raw.registrationEnabled),
      });
      this.form.reset();
    });
  }

  protected async save(item: ProgramItem): Promise<void> {
    const zone = this.event()?.timezone;
    if (!zone) return;

    const draft = this.draft(item.id);
    await this.change(() =>
      this.program.update(item.id, {
        title: draft.title,
        speaker: draft.speaker.trim() || null,
        description: draft.description.trim() || null,
        startsAt: wallClockToInstant(draft.startsAt, zone),
        endsAt: wallClockToInstant(draft.endsAt, zone),
        registrationEnabled: draft.registrationEnabled,
        capacity: capacityOf(draft.capacity, draft.registrationEnabled),
      }),
    );
  }

  protected async remove(item: ProgramItem): Promise<void> {
    // The number is part of the question: deleting a session releases the seats
    // people claimed in it, and an organizer should not learn that afterwards.
    const seats =
      item.signupCount > 0
        ? ` ${this.i18n.translate(
            item.signupCount === 1
              ? 'admin.program.confirmRemoveSeats.one'
              : 'admin.program.confirmRemoveSeats.many',
            { count: item.signupCount },
          )}`
        : '';
    const question = this.i18n.translate('admin.program.confirmRemove', {
      title: item.title,
    });
    if (!confirm(`${question}${seats}`)) return;
    await this.change(() => this.program.remove(item.id));
  }

  /**
   * The language every time on this page is written in.
   *
   * The reader's, not the instance's default (F78): the *zone* is the event's
   * (E8), the words around it belong to whoever is looking. Read as a signal, so
   * the memoised {@link days} recomputes when the language changes (F72).
   */
  private locale(): string {
    return this.i18n.locale();
  }

  private async load(eventId: string): Promise<void> {
    this.loading.set(true);
    try {
      this.event.set(await this.events.get(eventId));
    } catch (error: unknown) {
      this.event.set(null);
      this.loading.set(false);
      this.report(error, 'admin.events.errorMissing');
      return;
    }

    try {
      this.apply(await this.program.list(eventId));
      this.error.set(null);
    } catch (error: unknown) {
      this.report(error, 'admin.program.errorLoad');
    } finally {
      this.loading.set(false);
    }
  }

  /** Replaces the list and the drafts that belong to it in one step. */
  private apply(items: readonly ProgramItem[]): void {
    this.items.set(items);
    this.drafts.set(
      Object.fromEntries(items.map((item) => [item.id, this.draftOf(item)])),
    );
  }

  /**
   * The card values of one item, in the event's zone.
   *
   * A method rather than a free function, because the zone comes from the event
   * this page loaded — a programme item has none of its own (E8).
   */
  private draftOf(item: ProgramItem): ItemDraft {
    const zone = this.event()?.timezone;
    return {
      title: item.title,
      speaker: item.speaker ?? '',
      description: item.description ?? '',
      startsAt: zone ? instantToWallClock(item.startsAt, zone) : '',
      endsAt: zone ? instantToWallClock(item.endsAt, zone) : '',
      registrationEnabled: item.registrationEnabled,
      capacity: item.capacity === null ? '' : String(item.capacity),
    };
  }

  private async change(action: () => Promise<unknown>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      // Read back rather than patched in place: the server owns the order, and
      // the order is the clock.
      this.apply(await this.program.list(this.eventId()));
      // A session whose sign-up was just switched off, or which is gone: an open
      // list of its attendees would be describing something that changed.
      const open = this.openSignups();
      if (open && !this.items().some((item) => item.id === open)) {
        this.openSignups.set(null);
      }
    } catch (error: unknown) {
      this.report(error, 'admin.fields.errorSave');
    } finally {
      this.busy.set(false);
    }
  }

  private report(error: unknown, key: string): void {
    this.error.set(problemOf(error, key));
  }
}

function blankDraft(): ItemDraft {
  return {
    title: '',
    speaker: '',
    description: '',
    startsAt: '',
    endsAt: '',
    registrationEnabled: false,
    capacity: '',
  };
}

/**
 * The seats an input holds, as the API takes them.
 *
 * `null` for an empty field and for a session that does not ask who is coming:
 * the server refuses a capacity without sign-up, so sending one would turn a
 * cleared checkbox into an error message instead of a saved session.
 *
 * `string | number`, and that is not defensive: an `<input type="number">` bound
 * with `formControlName` writes a **number** into the control, whatever the form
 * declares — Angular's `NumberValueAccessor` does the conversion, and `tsc` sees
 * none of it. The card inputs on this page hand over a string. Both arrive here.
 */
function capacityOf(
  value: string | number,
  registrationEnabled: boolean,
): number | null {
  if (!registrationEnabled) return null;
  const raw = String(value).trim();
  if (raw === '') return null;
  const seats = Number(raw);
  return Number.isFinite(seats) ? seats : null;
}
