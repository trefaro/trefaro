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
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { problemOf, type ApiError, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type { EventType } from '@trefaro/shared-models';
import {
  eventStatusKey,
  EVENT_STATUSES,
  EVENT_TYPES,
  MAX_FOLLOW_UP_LENGTH,
  hasEnded,
  instantToWallClock,
  localTimeZone,
  wallClockToInstant,
} from '@trefaro/shared-models';
import { EventsAdminService } from '../../features/events/events-admin.service';
import { eventTypeKey } from '../../features/i18n/labels';

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
 * - **The follow-up text can be written before the event.** It only reaches the
 *   landing page once the event has ended — the server withholds it until then
 *   (F50) — so this field says so rather than leaving an organizer to wonder
 *   whether they have just published next month's thank-you note.
 *
 * The logo FR 3.1 asks for is missing until uploads exist (AP 7); the column is
 * already in the schema.
 */
@Component({
  selector: 'trefaro-event-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  template: `
    <header class="head">
      <h1>
        {{ (isNew() ? 'admin.events.new' : 'admin.events.edit') | transloco }}
      </h1>
      @if (!isNew()) {
        <nav class="head__links">
          <!-- The event's dashboard is the hub (FR 3.8); this form is one of
               the things reachable from it, so it only leads back. -->
          <a [routerLink]="['/series', seriesId(), 'events', eventId()]">
            {{ 'admin.events.back' | transloco }}
          </a>
        </nav>
      }
    </header>

    @if (error(); as problem) {
      <p class="error" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="error__detail">{{ detail }}</span>
        }
      </p>
    }

    <form [formGroup]="form" (ngSubmit)="submit()">
      <label for="name">{{ 'admin.events.name' | transloco }}</label>
      <input id="name" formControlName="name" required />

      <label for="description">
        {{ 'admin.events.description' | transloco }}
      </label>
      <textarea id="description" formControlName="description" rows="5">
      </textarea>

      <label for="slug">{{ 'admin.events.publicAddress' | transloco }}</label>
      <input
        id="slug"
        formControlName="slug"
        [placeholder]="'admin.common.slugPlaceholder' | transloco"
      />
      <small>{{ 'admin.events.slugHint' | transloco }}</small>

      <label for="eventType">{{ 'admin.events.type' | transloco }}</label>
      <select id="eventType" formControlName="eventType">
        @for (type of types; track type) {
          <option [value]="type">{{ typeKey(type) | transloco }}</option>
        }
      </select>

      <!-- The zone list stays as it is: Europe/Berlin is an identifier, and
           translating one would be translating an address. (No backticks in a
           template comment — they end the template literal.) -->
      <label for="timezone">{{ 'admin.events.timezone' | transloco }}</label>
      <select id="timezone" formControlName="timezone">
        @for (zone of zones; track zone) {
          <option [value]="zone">{{ zone }}</option>
        }
      </select>
      <small>{{ 'admin.events.timezoneHint' | transloco }}</small>

      <label for="startsAt">{{ 'admin.events.startsAt' | transloco }}</label>
      <input
        id="startsAt"
        type="datetime-local"
        formControlName="startsAt"
        required
      />

      <label for="endsAt">{{ 'admin.events.endsAt' | transloco }}</label>
      <input
        id="endsAt"
        type="datetime-local"
        formControlName="endsAt"
        required
      />

      @if (needsVenue()) {
        <label for="venueName">{{
          'admin.events.venueName' | transloco
        }}</label>
        <input id="venueName" formControlName="venueName" />

        <label for="venueAddress">
          {{ 'admin.events.venueAddress' | transloco }}
        </label>
        <textarea id="venueAddress" formControlName="venueAddress" rows="3">
        </textarea>
      }

      @if (needsLink()) {
        <label for="onlineUrl">{{
          'admin.events.onlineUrl' | transloco
        }}</label>
        <input id="onlineUrl" type="url" formControlName="onlineUrl" />
      }

      <fieldset>
        <legend>{{ 'admin.events.languages' | transloco }}</legend>
        @for (locale of locales(); track locale) {
          <label class="check">
            <input
              type="checkbox"
              [value]="locale"
              [checked]="languages().includes(locale)"
              (change)="toggleLanguage(locale)"
            />
            <!-- The language's own name rather than its tag: "de" is what the
                 database stores, "Deutsch" is what the box is asking about. -->
            {{ languageName(locale) }}
          </label>
        }
        <small>{{ 'admin.events.languagesHint' | transloco }}</small>
      </fieldset>

      <label for="followUpBody">{{
        'admin.events.followUp' | transloco
      }}</label>
      <textarea
        id="followUpBody"
        formControlName="followUpBody"
        rows="4"
        [attr.maxlength]="maxFollowUpLength"
      >
      </textarea>
      <small>
        {{ followUpHintKey() | transloco }}
        <!-- The page's own name, from the module's key, so renaming the module
             renames it here too. -->
        {{
          'admin.events.followUpMedia'
            | transloco: { page: 'modules.mediaLinks.title' | transloco }
        }}
      </small>

      <label for="status">{{ 'admin.events.status' | transloco }}</label>
      <select id="status" formControlName="status">
        @for (status of statuses; track status) {
          <option [value]="status">{{ statusKey(status) | transloco }}</option>
        }
      </select>
      <small>{{ 'admin.events.statusHint' | transloco }}</small>

      <div class="actions">
        <button type="submit" [disabled]="busy()">
          {{
            (busy() ? 'admin.common.saving' : 'admin.common.save') | transloco
          }}
        </button>
        <a [routerLink]="cancelTarget()">
          {{ 'admin.common.cancel' | transloco }}
        </a>
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

    .head__links {
      display: flex;
      gap: 1rem;
      white-space: nowrap;
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
  protected readonly maxFollowUpLength = MAX_FOLLOW_UP_LENGTH;
  /**
   * Every zone the runtime knows, so an organization anywhere finds its own.
   * The fallback covers a browser without `supportedValuesOf`.
   */
  protected readonly zones: readonly string[] = Intl.supportedValuesOf?.(
    'timeZone',
  ) ?? [localTimeZone(), 'UTC'];

  protected readonly isNew = computed(() => !this.eventId());
  /**
   * Where "Cancel" goes: back where the organizer came from.
   *
   * An existing event was opened from its dashboard, a new one from the series
   * — and a new event has no dashboard to return to.
   */
  protected readonly cancelTarget = computed(() => {
    const id = this.eventId();
    return id
      ? ['/series', this.seriesId(), 'events', id]
      : ['/series', this.seriesId()];
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<Problem | null>(null);
  protected readonly languages = signal<readonly string[]>([]);
  protected readonly typeKey = eventTypeKey;
  protected readonly statusKey = eventStatusKey;

  private readonly events = inject(EventsAdminService);
  private readonly config = inject(AppConfigService);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslationService);

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
    followUpBody: [''],
    status: ['draft'],
  });

  private readonly eventType = signal<EventType>('onsite');
  protected readonly needsVenue = computed(() => this.eventType() !== 'online');
  protected readonly needsLink = computed(() => this.eventType() !== 'onsite');
  /** Whether the event this form is editing is already over (F50). */
  private readonly over = signal(false);

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

  /**
   * What the follow-up field promises, in the tense that is true.
   *
   * The event's own end decides it, so an organizer editing a conference that
   * finished last week is told the text is live — and one planning next June's
   * is told it is not yet.
   */
  protected followUpHintKey(): string {
    return this.over()
      ? 'admin.events.followUpLive'
      : 'admin.events.followUpPending';
  }

  /** "Deutsch" rather than "de", in the language the organizer is reading. */
  protected languageName(locale: string): string {
    return this.i18n.languageName(locale);
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
      this.error.set({ key: 'admin.events.errorNoLanguage', detail: null });
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
      // Unlike the venue fields, never cleared by a rule of this form: an
      // emptied box means no text, and the server reads it the same way.
      followUpBody: raw.followUpBody.trim() || null,
      languages: [...this.languages()],
      status: raw.status as (typeof EVENT_STATUSES)[number],
    };

    try {
      const id = this.eventId();
      if (id) {
        await this.events.update(id, payload);
        // Back to the dashboard the organizer came from, which is where the
        // change is visible — a new event has no dashboard to return to yet.
        await this.router.navigate(['/series', this.seriesId(), 'events', id]);
      } else {
        await this.events.create(this.seriesId(), payload);
        await this.router.navigate(['/series', this.seriesId()]);
      }
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.common.savingFailed'));
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
        followUpBody: event.followUpBody ?? '',
        status: event.status,
      });
      this.eventType.set(event.eventType);
      this.languages.set(event.languages);
      this.over.set(hasEnded(event));
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.status === 404
          ? { key: 'admin.events.errorMissing', detail: null }
          : problemOf(error, 'admin.common.loadingFailed'),
      );
    }
  }
}
