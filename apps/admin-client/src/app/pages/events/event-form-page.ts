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
import { Router, RouterLink } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import type { ApiError } from '@trefaro/shared-http';
import type { EventType } from '@trefaro/shared-models';
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  instantToWallClock,
  localTimeZone,
  wallClockToInstant,
} from '@trefaro/shared-models';
import { EventsAdminService } from '../../features/events/events-admin.service';

/**
 * Create and edit an event (UC 04, UC 05, FR 3.1, FR 3.2, FR 3.9).
 *
 * The two fields that need explaining:
 *
 * - **Times are entered as wall clock and stored as instants.** The organizer
 *   types "09:00" and picks the venue's zone; the client converts. Typing UTC
 *   by hand is how a conference ends up starting at 10:00 (E8).
 * - **Venue and link appear with the type.** An on-site event has no stream URL
 *   to fill in, and a field that does not apply is a field that gets filled in
 *   wrongly.
 *
 * The logo FR 3.1 asks for is missing until uploads exist (AP 7); the column is
 * already in the schema.
 */
@Component({
  selector: 'trefaro-event-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <header class="head">
      <h1>{{ isNew() ? 'New event' : 'Edit event' }}</h1>
      @if (!isNew()) {
        <a
          [routerLink]="[
            '/series',
            seriesId(),
            'events',
            eventId(),
            'participants',
          ]"
        >
          Participants
        </a>
      }
    </header>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <form [formGroup]="form" (ngSubmit)="submit()">
      <label for="name">Name</label>
      <input id="name" formControlName="name" required />

      <label for="description">Description</label>
      <textarea id="description" formControlName="description" rows="5">
      </textarea>

      <label for="slug">Public address</label>
      <input
        id="slug"
        formControlName="slug"
        placeholder="derived from the name"
      />
      <small>
        Part of the link participants share, within this series. Leave it empty
        and the name decides; changing it later breaks links already out there.
      </small>

      <label for="eventType">Event type</label>
      <select id="eventType" formControlName="eventType">
        @for (type of types; track type) {
          <option [value]="type">{{ type }}</option>
        }
      </select>

      <label for="timezone">Time zone</label>
      <select id="timezone" formControlName="timezone">
        @for (zone of zones; track zone) {
          <option [value]="zone">{{ zone }}</option>
        }
      </select>
      <small>
        Times below are read in this zone — that is also how participants see
        them, wherever they are.
      </small>

      <label for="startsAt">Starts</label>
      <input
        id="startsAt"
        type="datetime-local"
        formControlName="startsAt"
        required
      />

      <label for="endsAt">Ends</label>
      <input
        id="endsAt"
        type="datetime-local"
        formControlName="endsAt"
        required
      />

      @if (needsVenue()) {
        <label for="venueName">Venue</label>
        <input id="venueName" formControlName="venueName" />

        <label for="venueAddress">Address</label>
        <textarea id="venueAddress" formControlName="venueAddress" rows="3">
        </textarea>
      }

      @if (needsLink()) {
        <label for="onlineUrl">Online link</label>
        <input id="onlineUrl" type="url" formControlName="onlineUrl" />
      }

      <fieldset>
        <legend>Languages</legend>
        @for (locale of locales(); track locale) {
          <label class="check">
            <input
              type="checkbox"
              [value]="locale"
              [checked]="languages().includes(locale)"
              (change)="toggleLanguage(locale)"
            />
            {{ locale }}
          </label>
        }
        <small>The languages the event is held in.</small>
      </fieldset>

      <label for="status">Status</label>
      <select id="status" formControlName="status">
        @for (status of statuses; track status) {
          <option [value]="status">{{ status }}</option>
        }
      </select>
      <small>
        Publishing needs whatever makes the event reachable: a venue, a link, or
        both.
      </small>

      <div class="actions">
        <button type="submit" [disabled]="busy()">
          {{ busy() ? 'Saving…' : 'Save' }}
        </button>
        <a [routerLink]="['/series', seriesId()]">Cancel</a>
      </div>
    </form>
  `,
  styles: `
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      inline-size: min(34rem, 100%);
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      inline-size: min(34rem, 100%);
    }

    label {
      font-weight: 600;
      margin-block-start: 0.75rem;
    }

    input,
    textarea,
    select {
      padding: 0.5rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      font: inherit;
    }

    fieldset {
      margin-block-start: 0.75rem;
      border: 1px solid color-mix(in oklab, currentColor 20%, transparent);
      border-radius: 0.4rem;
    }

    .check {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      margin-inline-end: 0.9rem;
      font-weight: 400;
    }

    .check input {
      inline-size: auto;
    }

    small {
      color: color-mix(in oklab, currentColor 60%, transparent);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-block-start: 1.5rem;
    }

    button[type='submit'] {
      padding: 0.55rem 0.9rem;
      border: 0;
      border-radius: 0.4rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    .error {
      color: #a3341f;
    }
  `,
})
export class EventFormPage {
  readonly seriesId = input.required<string>();
  /** Absent on `…/events/new`; bound from the route otherwise. */
  readonly eventId = input<string | undefined>(undefined);

  protected readonly types = EVENT_TYPES;
  protected readonly statuses = EVENT_STATUSES;
  /**
   * Every zone the runtime knows, so an organization anywhere finds its own.
   * The fallback covers a browser without `supportedValuesOf`.
   */
  protected readonly zones: readonly string[] = Intl.supportedValuesOf?.(
    'timeZone',
  ) ?? [localTimeZone(), 'UTC'];

  protected readonly isNew = computed(() => !this.eventId());
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly languages = signal<readonly string[]>([]);

  private readonly events = inject(EventsAdminService);
  private readonly config = inject(AppConfigService);
  private readonly router = inject(Router);

  /** The locales this instance maintains, which is what an event can be held in. */
  protected readonly locales = computed<readonly string[]>(
    () => this.config.config()?.availableLocales ?? ['en'],
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    description: ['', Validators.required],
    slug: [''],
    eventType: ['onsite' as EventType],
    timezone: [localTimeZone()],
    startsAt: ['', Validators.required],
    endsAt: ['', Validators.required],
    venueName: [''],
    venueAddress: [''],
    onlineUrl: [''],
    status: ['draft'],
  });

  private readonly eventType = signal<EventType>('onsite');
  protected readonly needsVenue = computed(() => this.eventType() !== 'online');
  protected readonly needsLink = computed(() => this.eventType() !== 'onsite');

  constructor() {
    this.form.controls.eventType.valueChanges.subscribe((type) =>
      this.eventType.set(type),
    );

    effect(() => {
      const id = this.eventId();
      if (id) void this.load(id);
    });

    // A new event defaults to the languages the instance runs in: for most
    // organizations that is the answer, and it is one less empty field.
    effect(() => {
      if (this.isNew() && this.languages().length === 0) {
        this.languages.set(this.locales());
      }
    });
  }

  protected toggleLanguage(locale: string): void {
    const current = this.languages();
    this.languages.set(
      current.includes(locale)
        ? current.filter((entry) => entry !== locale)
        : [...current, locale],
    );
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.languages().length === 0) {
      this.error.set('Pick at least one language the event is held in.');
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name,
      description: raw.description,
      // An untouched address field must not be sent: on an update it would
      // rewrite the slug, and on a create the server derives a better one.
      ...(raw.slug.trim() ? { slug: raw.slug.trim() } : {}),
      eventType: raw.eventType,
      timezone: raw.timezone,
      startsAt: wallClockToInstant(raw.startsAt, raw.timezone),
      endsAt: wallClockToInstant(raw.endsAt, raw.timezone),
      // Cleared rather than kept when the type no longer has the field: a
      // stale stream URL on an on-site event would show up on the landing page.
      venueName: this.needsVenue() ? raw.venueName.trim() || null : null,
      venueAddress: this.needsVenue() ? raw.venueAddress.trim() || null : null,
      onlineUrl: this.needsLink() ? raw.onlineUrl.trim() || null : null,
      languages: [...this.languages()],
      status: raw.status as (typeof EVENT_STATUSES)[number],
    };

    try {
      const id = this.eventId();
      if (id) {
        await this.events.update(id, payload);
      } else {
        await this.events.create(this.seriesId(), payload);
      }
      await this.router.navigate(['/series', this.seriesId()]);
    } catch (error: unknown) {
      this.error.set((error as ApiError)?.message ?? 'Saving failed.');
    } finally {
      this.busy.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    this.error.set(null);
    try {
      const event = await this.events.get(id);
      // A slow answer must not overwrite what the organizer has already typed.
      if (this.form.dirty) return;
      this.form.setValue({
        name: event.name,
        description: event.description,
        slug: event.slug,
        eventType: event.eventType,
        timezone: event.timezone,
        startsAt: instantToWallClock(event.startsAt, event.timezone),
        endsAt: instantToWallClock(event.endsAt, event.timezone),
        venueName: event.venueName ?? '',
        venueAddress: event.venueAddress ?? '',
        onlineUrl: event.onlineUrl ?? '',
        status: event.status,
      });
      this.eventType.set(event.eventType);
      this.languages.set(event.languages);
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.status === 404
          ? 'This event no longer exists.'
          : ((error as ApiError)?.message ?? 'Loading failed.'),
      );
    }
  }
}
